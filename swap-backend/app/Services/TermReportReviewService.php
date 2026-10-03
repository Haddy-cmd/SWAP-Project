<?php

namespace App\Services;

use App\Jobs\SendApplicationNotificationJob;
use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\TermReport;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * The supervisor accepts the end-of-term narrative report and marks the student eligible
 * or not eligible for renewal. For a student who completed their hours, renewal needs an
 * accepted report marked eligible (RenewalReadinessService); a student short on hours
 * renews on an approved promissory note plus a submitted report instead.
 */
class TermReportReviewService
{
    public const MSG_NOT_SUBMITTED = 'This student has not submitted their end-of-term report yet.';
    public const MSG_NOT_ACTIVE = 'This placement has ended, so its end-of-term report can no longer be reviewed.';

    public function review(User $supervisor, Assignment $assignment, bool $eligible, ?string $remarks): TermReport
    {
        if (!$assignment->governingSupervisors()->contains('id', $supervisor->id)) {
            throw new NotFoundHttpException('Student not found or not assigned to you.');
        }
        if ($assignment->status !== 'active') {
            throw new UnprocessableEntityHttpException(self::MSG_NOT_ACTIVE);
        }
        $report = $assignment->termReport;
        if (!$report?->submitted_at) {
            throw new UnprocessableEntityHttpException(self::MSG_NOT_SUBMITTED);
        }

        $old = $report->only(['reviewed_at', 'renewal_eligible', 'review_remarks']);
        $report->forceFill([
            'reviewed_at' => now(),
            'reviewed_by' => $supervisor->id,
            'renewal_eligible' => $eligible,
            'review_remarks' => $remarks !== null && trim($remarks) !== '' ? trim($remarks) : null,
        ])->save();
        AuditLog::record('term_report_reviewed', $report, $old, $report->only(['renewal_eligible', 'review_remarks']), $supervisor->id);

        self::dispatchQuietly('term_report_reviewed', [
            'user_id' => $assignment->user_id,
            'assignment_id' => $assignment->id,
            'term' => "{$assignment->semester} {$assignment->academic_year}",
            'renewal_eligible' => $eligible,
            'review_remarks' => $report->review_remarks,
            'reviewer' => $supervisor->name,
        ]);

        return $report->load('reviewer');
    }

    /** Tell the placement's supervisors a report came in (first submission only). */
    public static function notifySubmitted(Assignment $assignment, User $student): void
    {
        foreach ($assignment->governingSupervisors() as $supervisor) {
            self::dispatchQuietly('term_report_submitted', [
                'user_id' => $supervisor->id,
                'student_id' => $student->id,
                'student_name' => $student->name,
                'assignment_id' => $assignment->id,
                'term' => "{$assignment->semester} {$assignment->academic_year}",
            ]);
        }
    }

    private static function dispatchQuietly(string $type, array $data): void
    {
        try {
            SendApplicationNotificationJob::dispatch($type, $data)->onQueue('notifications');
        } catch (\Throwable $e) {
            Log::warning('Term report notification dispatch failed', ['type' => $type, 'error' => $e->getMessage()]);
        }
    }
}
