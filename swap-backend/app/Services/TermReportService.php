<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\StipendHistory;
use App\Models\TermReport;
use App\Models\User;
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

    /** @return array{assignment: ?Assignment, report: ?TermReport, editable: bool} */
    public function forUser(User $user): array
    {
        $assignment = Assignment::with('termReport')
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        return [
            'assignment' => $assignment,
            'report' => $assignment?->termReport,
            'editable' => $assignment !== null && !self::isLocked($assignment),
        ];
    }

    public function save(User $user, array $data): TermReport
    {
        ['assignment' => $assignment, 'report' => $report] = $this->forUser($user);

        if (!$assignment) {
            throw new UnprocessableEntityHttpException(self::MSG_NO_ASSIGNMENT);
        }
        if (self::isLocked($assignment)) {
            throw new UnprocessableEntityHttpException(self::MSG_LOCKED);
        }

        $old = $report?->only(['content', 'accomplishments', 'challenges']);
        $report ??= new TermReport(['assignment_id' => $assignment->id, 'user_id' => $user->id]);
        $report->fill([
            'content' => $data['content'],
            'accomplishments' => $data['accomplishments'] ?? null,
            'challenges' => $data['challenges'] ?? null,
            'submitted_at' => $report->submitted_at ?? now(),
        ])->save();

        AuditLog::record($old ? 'term_report_updated' : 'term_report_submitted', $report, $old,
            $report->only(['assignment_id', 'content', 'accomplishments', 'challenges']), $user->id);

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
            'submitted_at' => $report->submitted_at?->toISOString(),
            'updated_at' => $report->updated_at?->toISOString(),
        ] : null;
    }
}
