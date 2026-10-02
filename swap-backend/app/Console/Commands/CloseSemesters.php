<?php

namespace App\Console\Commands;

use App\Models\Assignment;
use App\Models\SemesterPeriod;
use App\Services\SemesterPeriodService;
use App\Services\TermStatusService;
use Illuminate\Console\Command;

/**
 * Daily: for every semester period (Admin → Semesters) that has ended, record each
 * placement's verdict — Qualified, or Deficient with the shortfall — and re-qualify
 * deficient terms whose makeup is now verified. Idempotent.
 *
 * Driven by periods on purpose: a term the DSA never set up is left alone. Students
 * are only emailed about terms that ended recently, so adding an old semester for
 * the record doesn't message a whole past cohort.
 */
class CloseSemesters extends Command
{
    /** Terms that ended longer ago than this are recorded without notifying anyone. */
    public const NOTIFY_WITHIN_DAYS = 14;

    protected $signature = 'semester:close {--dry-run : Report what would change without saving or notifying}';

    protected $description = 'Record Qualified/Deficient for every placement whose semester period has ended.';

    public function handle(TermStatusService $terms): int
    {
        $today = SemesterPeriodService::today();
        $dryRun = (bool) $this->option('dry-run');
        $counts = ['qualified' => 0, 'deficient' => 0, 'requalified' => 0, 'remeasured' => 0];

        $ended = SemesterPeriod::where('end_date', '<', $today->toDateString())->orderBy('end_date')->get();

        foreach ($ended as $period) {
            $notify = !$dryRun && $period->end_date->toDateString() >= $today->copy()->subDays(self::NOTIFY_WITHIN_DAYS)->toDateString();

            Assignment::where('academic_year', $period->academic_year)
                ->where('semester', $period->semester)
                ->whereIn('status', ['active', 'completed'])
                ->where(fn ($q) => $q->whereNull('term_status')->orWhere('term_status', Assignment::TERM_DEFICIENT))
                ->withSum(['timeLogs as verified_sum' => fn ($q) => $q->where('status', 'verified')], 'duration_hours')
                ->chunkById(200, function ($assignments) use ($terms, $today, $dryRun, $notify, &$counts) {
                    foreach ($assignments as $assignment) {
                        // An assignment's own end date can run past its period's.
                        $endsAt = TermStatusService::termEndsAt($assignment);
                        if (!$endsAt || $endsAt->gte($today)) {
                            continue;
                        }

                        $result = $dryRun
                            ? $this->preview($terms, $assignment)
                            // Only a current placement's student hears about it; a term
                            // already rolled into the next one is recorded quietly.
                            : $terms->close($assignment, $notify && $assignment->status === 'active');

                        if ($result) {
                            $counts[$result]++;
                        }
                    }
                });

            if (!$dryRun && $period->closed_at === null) {
                $period->update(['closed_at' => now()]);
            }
        }

        $this->info(sprintf(
            '%s%d qualified, %d deficient, %d re-qualified after makeup, %d re-measured, across %d ended semester(s).',
            $dryRun ? '[dry run] ' : '',
            $counts['qualified'], $counts['deficient'], $counts['requalified'], $counts['remeasured'], $ended->count(),
        ));

        return self::SUCCESS;
    }

    private function preview(TermStatusService $terms, Assignment $assignment): ?string
    {
        $short = $terms->shortfall($assignment) > 0;

        return match ($assignment->term_status) {
            null => $short ? 'deficient' : 'qualified',
            Assignment::TERM_DEFICIENT => $short ? null : 'requalified',
            default => null,
        };
    }
}
