<?php

namespace App\Services;

use App\Http\Requests\TermReport\SaveTermReportRequest;
use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\PromissoryNote;
use App\Models\StipendHistory;
use App\Models\TermReport;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * The end-of-term narrative report: one per assignment, written by the recipient
 * and editable until their stipend for that term is released. It replaced the
 * per-session narrative as a payout requirement (StipendClaimService checks it).
 */
class TermReportService
{
    public const MSG_NO_ASSIGNMENT = 'You have no active assignment.';
    public const MSG_LOCKED = 'Your end-of-term report can no longer be edited because your stipend has been released.';
    public const MSG_ACCEPTED = 'Your end-of-term report was accepted by your supervisor and can no longer be edited.';

    private const TIMEZONE = 'Asia/Manila';

    /** @return array{assignment: ?Assignment, report: ?TermReport, editable: bool, submit_block: ?string} */
    public function forUser(User $user): array
    {
        $assignment = Assignment::with('termReport')
            ->where('user_id', $user->id)
            ->current()
            ->first();

        return [
            'assignment' => $assignment,
            'report' => $assignment?->termReport,
            'editable' => $assignment !== null && !self::isLocked($assignment) && !$assignment->termReport?->reviewed_at,
            // Why a first submission isn't open yet (null = it is, or the report is already in).
            'submit_block' => $assignment && !$assignment->termReport?->submitted_at ? self::submitBlock($assignment) : null,
        ];
    }

    /**
     * The report opens once the semester has ended, and then only with the required hours
     * verified or a promissory note filed (pending is enough) for the shortfall. Null = allowed.
     * System Testing accounts follow it too (unlike the clock-in window), so a demo shows the real
     * flow; the "Complete hours" / "End term" / "Term report" shortcuts get them there.
     */
    public static function submitBlock(Assignment $assignment): ?string
    {
        $end = app(PromissoryService::class)->semesterEndFor($assignment);
        if ($end === null) {
            return PromissoryService::msgNoPeriod($assignment);
        }
        if (Carbon::now(self::TIMEZONE)->lt($end->copy()->endOfDay())) {
            return self::msgNotEnded($end);
        }

        $required = (float) $assignment->required_hours;
        $short = $required - (float) $assignment->verified_hours;
        if ($short > 0 && !$assignment->promissoryNotes()
            ->whereIn('status', [PromissoryNote::STATUS_PENDING, PromissoryNote::STATUS_APPROVED])->exists()) {
            return self::msgShort($short, $required);
        }

        return null;
    }

    public static function msgNotEnded(Carbon $end): string
    {
        return 'You can submit your end-of-term report after the semester ends on ' . $end->format('M j, Y') . '.';
    }

    public static function msgShort(float $short, float $required): string
    {
        $fmt = fn (float $h) => rtrim(rtrim(number_format($h, 2, '.', ''), '0'), '.');

        return "You're {$fmt($short)}h short of the {$fmt($required)} required hours. File a promissory note on the Stipend page first, then submit your report.";
    }

    public function save(User $user, array $data, ?UploadedFile $file = null): TermReport
    {
        ['assignment' => $assignment, 'report' => $report] = $this->forUser($user);

        if (!$assignment) {
            throw new UnprocessableEntityHttpException(self::MSG_NO_ASSIGNMENT);
        }
        if (self::isLocked($assignment)) {
            throw new UnprocessableEntityHttpException(self::MSG_LOCKED);
        }
        if ($report?->reviewed_at) {
            throw new UnprocessableEntityHttpException(self::MSG_ACCEPTED);
        }
        // First submission only: an already-submitted report stays editable as before.
        if (!$report?->submitted_at && ($block = self::submitBlock($assignment))) {
            throw new UnprocessableEntityHttpException($block);
        }

        // Typed or uploaded: at least one must remain after this save.
        $content = $data['content'] ?? null;
        $removeFile = (bool) ($data['remove_file'] ?? false);
        $keepsFile = $file !== null || (!$removeFile && $report?->file_path);
        if (($content === null || trim($content) === '') && !$keepsFile) {
            throw new UnprocessableEntityHttpException(SaveTermReportRequest::MSG_EMPTY);
        }

        $old = $report?->only(['content', 'accomplishments', 'challenges', 'file_name']);
        $report ??= new TermReport(['assignment_id' => $assignment->id, 'user_id' => $user->id]);
        $oldPath = $report->file_path;
        if ($file !== null) {
            $report->fill([
                'file_path' => $this->storeFile($assignment, $file),
                'file_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
            ]);
        } elseif ($removeFile) {
            $report->fill(['file_path' => null, 'file_name' => null, 'mime_type' => null, 'file_size' => null]);
        }
        $report->fill([
            'content' => $content,
            'accomplishments' => $data['accomplishments'] ?? null,
            'challenges' => $data['challenges'] ?? null,
            'submitted_at' => $report->submitted_at ?? now(),
        ])->save();
        if ($oldPath && $oldPath !== $report->file_path) {
            Storage::disk(config('filesystems.documents_disk', 'public'))->delete($oldPath);
        }

        AuditLog::record($old ? 'term_report_updated' : 'term_report_submitted', $report, $old,
            $report->only(['assignment_id', 'content', 'accomplishments', 'challenges', 'file_name']), $user->id);
        if (!$old) {
            TermReportReviewService::notifySubmitted($assignment, $user);
        }

        return $report;
    }

    /** Frozen once a stub for the term exists (certified, claimed, or legacy-released). */
    public static function isLocked(Assignment $assignment): bool
    {
        return StipendHistory::where('user_id', $assignment->user_id)
            ->where('academic_year', $assignment->academic_year)
            ->where('semester', $assignment->semester)
            ->whereIn('status', ['pending', 'certified', 'claimed', 'released'])
            ->exists();
    }

    public static function toArray(?TermReport $report): ?array
    {
        return $report ? [
            'id' => $report->id,
            'assignment_id' => $report->assignment_id,
            'content' => $report->content,
            'accomplishments' => $report->accomplishments,
            'challenges' => $report->challenges,
            // The uploaded PDF/Word version, if any (downloaded through the term-report file routes).
            'has_file' => $report->file_path !== null,
            'file_name' => $report->file_name,
            'mime_type' => $report->mime_type,
            'file_size' => $report->file_size,
            'submitted_at' => $report->submitted_at?->toISOString(),
            'updated_at' => $report->updated_at?->toISOString(),
            // The supervisor's acceptance and renewal mark (null until accepted).
            'reviewed_at' => $report->reviewed_at?->toISOString(),
            'reviewer' => $report->reviewed_by ? ($report->reviewer?->name) : null,
            'renewal_eligible' => $report->reviewed_at ? (bool) $report->renewal_eligible : null,
            'review_remarks' => $report->review_remarks,
        ] : null;
    }

    /** Stream the uploaded report with its original name. */
    public static function download(TermReport $report): StreamedResponse
    {
        return Storage::disk(config('filesystems.documents_disk', 'public'))->download($report->file_path, $report->file_name);
    }

    /** Store the uploaded report; storage misconfig surfaces as a 500 with the root cause logged. */
    private function storeFile(Assignment $assignment, UploadedFile $file): string
    {
        $disk = config('filesystems.documents_disk', 'public');

        try {
            $path = $file->store("term-reports/{$assignment->id}", $disk);
            if ($path === false) {
                throw new \Exception('File storage driver returned false (check credentials and permissions).');
            }

            return $path;
        } catch (\Throwable $e) {
            $root = $e;
            while ($root->getPrevious()) {
                $root = $root->getPrevious();
            }
            Log::error('Term report upload failed', [
                'disk' => $disk,
                'error' => $e->getMessage(),
                'cause' => $root->getMessage(),
            ]);
            throw new HttpException(500, 'Failed to upload the report file.');
        }
    }
}
