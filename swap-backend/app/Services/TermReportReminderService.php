<?php

namespace App\Services;

use App\Jobs\SendApplicationNotificationJob;
use App\Models\Assignment;
use App\Models\AuditLog;
use App\Support\AfterCommit;

/**
 * Tells the student (email + bell) to submit their end-of-term narrative report:
 * once when the required hours are met, once when the term ends — each only while
 * the report isn't in, and at most once per placement (`report_due_*_at`). The
 * recipient dashboard shows the same warning (TermReportDueBanner).
 */
class TermReportReminderService
{
    public const KIND_HOURS_MET = 'hours_met';
    public const KIND_TERM_ENDED = 'term_ended';

    /** After the hours change: the requirement is met and the report isn't in. */
    public function hoursMet(Assignment $assignment): bool
    {
        if ($assignment->report_due_hours_at || $assignment->report_due_ended_at
            || $assignment->required_hours <= 0 || $assignment->remaining_hours > 0) {
            return false;
        }

        return $this->remind($assignment, self::KIND_HOURS_MET, 'report_due_hours_at');
    }

    /** When the term closes (semester:close, current placements only). */
    public function termEnded(Assignment $assignment): bool
    {
        if ($assignment->report_due_ended_at) {
            return false;
        }

        return $this->remind($assignment, self::KIND_TERM_ENDED, 'report_due_ended_at');
    }

    private function remind(Assignment $assignment, string $kind, string $column): bool
    {
        if ($assignment->status !== 'active'
            || $assignment->termReport()->whereNotNull('submitted_at')->exists()
            || TermReportService::isLocked($assignment)) {
            return false;
        }

        $assignment->forceFill([$column => now()])->save();
        AuditLog::record('term_report_reminder', $assignment, null, ['kind' => $kind], null);

        $data = [
            'user_id' => $assignment->user_id,
            'assignment_id' => $assignment->id,
            'kind' => $kind,
            'term' => "{$assignment->semester} {$assignment->academic_year}",
            'required_hours' => (int) $assignment->required_hours,
        ];
        AfterCommit::quietly(
            fn () => SendApplicationNotificationJob::dispatch('term_report_due', $data)->onQueue('notifications'),
            'Term report reminder',
            ['assignment_id' => $assignment->id, 'kind' => $kind],
        );

        return true;
    }
}
