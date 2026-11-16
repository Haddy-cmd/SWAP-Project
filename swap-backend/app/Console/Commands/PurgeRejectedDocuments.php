<?php

namespace App\Console\Commands;

use App\Models\Application;
use App\Models\ApplicationDocument;
use App\Models\AuditLog;
use App\Models\SemesterPeriod;
use App\Services\SemesterPeriodService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Daily: data minimisation (RA 10173) for applicants who were not approved. A rejected
 * new application's uploaded files (COR, grades, letter, photo…) are deleted once a
 * newer semester has started, or 5 months after the rejection when the DSA's semester
 * calendar doesn't say (whichever comes first). The application record, its decision
 * and the audit trail stay; each document row is kept and marked `purged_at`.
 *
 * Renewals are left alone: their files belong to a former recipient's service record.
 */
class PurgeRejectedDocuments extends Command
{
    public const FALLBACK_MONTHS = 5;

    protected $signature = 'applications:purge-rejected-documents {--dry-run : List what would be removed without deleting}';

    protected $description = "Remove rejected applicants' uploaded files once a newer semester has started (or after 5 months).";

    public function handle(SemesterPeriodService $periods): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $today = SemesterPeriodService::today()->toDateString();
        // The newest semester that has already started: anything rejected for an earlier term is past.
        $latestStarted = SemesterPeriod::where('start_date', '<=', $today)->orderByDesc('start_date')->first();
        $cutoff = now()->subMonths(self::FALLBACK_MONTHS);
        $disk = config('filesystems.documents_disk', 'public');
        $apps = 0;
        $files = 0;

        Application::where('status', 'rejected')
            ->where('type', '!=', 'renewal')
            ->whereHas('documents', fn ($q) => $q->whereNull('purged_at'))
            ->with(['documents' => fn ($q) => $q->whereNull('purged_at')])
            ->chunkById(100, function ($applications) use ($periods, $latestStarted, $cutoff, $disk, $dryRun, &$apps, &$files) {
                foreach ($applications as $application) {
                    if (!self::isExpired($application, $periods, $latestStarted, $cutoff)) {
                        continue;
                    }

                    $apps++;
                    $files += $application->documents->count();
                    if ($dryRun) {
                        $this->line("Application #{$application->id} ({$application->semester} {$application->academic_year}): {$application->documents->count()} file(s)");
                        continue;
                    }

                    foreach ($application->documents as $doc) {
                        self::deleteFile($doc, $disk);
                        $doc->update(['purged_at' => now()]);
                    }

                    AuditLog::record('documents_purged', $application, null, [
                        'documents' => $application->documents->pluck('document_type')->values()->all(),
                        'count' => $application->documents->count(),
                    ], null);
                }
            });

        $this->info(sprintf('%s%d file(s) removed from %d rejected application(s).', $dryRun ? '[dry run] ' : '', $files, $apps));

        return self::SUCCESS;
    }

    /** A newer semester has started since this application's term, or the fallback months passed. */
    public static function isExpired(Application $application, SemesterPeriodService $periods, ?SemesterPeriod $latestStarted, Carbon $cutoff): bool
    {
        $decidedAt = $application->reviewed_at ?? $application->updated_at;
        if ($decidedAt && $decidedAt->lte($cutoff)) {
            return true;
        }

        if (!$latestStarted) {
            return false;
        }

        $own = $periods->forTerm($application->academic_year, $application->semester);
        if ($own) {
            return $latestStarted->start_date->gt($own->start_date);
        }

        // Term not on the calendar: a semester that started after the rejection.
        return $decidedAt !== null && $latestStarted->start_date->gt($decidedAt->copy()->timezone(SemesterPeriod::TIMEZONE)->startOfDay());
    }

    private static function deleteFile(ApplicationDocument $doc, string $disk): void
    {
        $path = $doc->file_path;
        // Imported applications point at a bundled placeholder, not a stored upload.
        if (!$path || str_starts_with($path, ApplicationDocument::PLACEHOLDER_PREFIX)) {
            return;
        }

        try {
            Storage::disk($disk)->delete($path);
        } catch (\Throwable $e) {
            Log::warning('Could not delete a rejected applicant document', ['document_id' => $doc->id, 'error' => $e->getMessage()]);
        }
    }
}
