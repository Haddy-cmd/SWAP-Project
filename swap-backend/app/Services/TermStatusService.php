<?php

namespace App\Services;

use App\Jobs\SendApplicationNotificationJob;
use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\SemesterPeriod;
use App\Models\User;
use App\Support\AfterCommit;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * A term's persisted verdict. When a semester ends (semester:close) each placement
 * becomes Qualified (verified ≥ required) or Deficient with the shortfall recorded;
 * a supervisor may also mark one Deficient during the term. Stipend release does
 * not wait for this — it still follows the hours as soon as they're met.
 */
class TermStatusService
{
    public const MSG_NOT_SHORT = 'This student has already met the required hours for the term.';
    public const MSG_ALREADY_DEFICIENT = 'This term is already marked deficient.';
    public const MSG_NOT_ACTIVE = 'Only a current placement can be marked deficient.';

    /**
     * The end-of-term verdict. Undecided → qualified/deficient; deficient → re-qualified
     * once the makeup is verified, and a mark made during the term is re-measured at
     * its end. Idempotent: an unchanged term returns null.
     *
     * @return 'qualified'|'deficient'|'requalified'|'remeasured'|null
     */
    public function close(Assignment $assignment, bool $notify = true): ?string
    {
        if ($assignment->term_status === Assignment::TERM_QUALIFIED) {
            return null;
        }

        if ($assignment->term_status === Assignment::TERM_DEFICIENT) {
            if ($this->refresh($assignment, $notify)) {
                return 'requalified';
            }

            return $this->remeasure($assignment) ? 'remeasured' : null;
        }

        $shortfall = $this->shortfall($assignment);
        $status = $shortfall > 0 ? Assignment::TERM_DEFICIENT : Assignment::TERM_QUALIFIED;

        $this->apply($assignment, [
            'term_status' => $status,
            'deficient_hours' => $shortfall > 0 ? $shortfall : null,
            'term_status_at' => now(),
            'term_status_by' => null,
            'term_status_reason' => null,
        ], 'term_closed', null);

        if ($status === Assignment::TERM_DEFICIENT && $notify) {
            $this->notify($assignment, 'deficient');
        }

        return $status;
    }

    /**
     * A deficient term whose verified hours later reach the requirement (the makeup)
     * becomes qualified. deficient_hours stays as the record of the shortfall.
     */
    public function refresh(Assignment $assignment, bool $notify = true): bool
    {
        if ($assignment->term_status !== Assignment::TERM_DEFICIENT || $this->shortfall($assignment) > 0) {
            return false;
        }

        $this->apply($assignment, [
            'term_status' => Assignment::TERM_QUALIFIED,
            'term_status_at' => now(),
            'term_status_by' => null,
            'term_status_reason' => null,
        ], 'term_requalified', null);

        if ($notify) {
            $this->notify($assignment, 'qualified');
        }

        return true;
    }

    /** After a log on this placement is verified: re-qualify a completed makeup at once. */
    public function refreshById(int $assignmentId): void
    {
        $assignment = Assignment::whereKey($assignmentId)->where('term_status', Assignment::TERM_DEFICIENT)->first();
        if ($assignment) {
            $this->refresh($assignment);
        }
    }

    /** A governing supervisor marks a current placement deficient, with a reason. */
    public function markDeficient(Assignment $assignment, User $supervisor, string $reason): Assignment
    {
        if (!$assignment->governingSupervisors()->contains('id', $supervisor->id)) {
            throw new NotFoundHttpException('Student not found or not assigned to you.');
        }
        if ($assignment->status !== 'active') {
            throw new UnprocessableEntityHttpException(self::MSG_NOT_ACTIVE);
        }
        if ($assignment->term_status === Assignment::TERM_DEFICIENT) {
            throw new UnprocessableEntityHttpException(self::MSG_ALREADY_DEFICIENT);
        }

        $shortfall = $this->shortfall($assignment);
        if ($shortfall <= 0) {
            throw new UnprocessableEntityHttpException(self::MSG_NOT_SHORT);
        }

        $this->apply($assignment, [
            'term_status' => Assignment::TERM_DEFICIENT,
            'deficient_hours' => $shortfall,
            'term_status_at' => now(),
            'term_status_by' => $supervisor->id,
            'term_status_reason' => $reason,
        ], 'term_marked_deficient', $supervisor->id);

        $this->notify($assignment, 'deficient', $reason);

        return $assignment->fresh();
    }

    /** Hours still short of the requirement (0 when met). */
    public function shortfall(Assignment $assignment): float
    {
        $required = (float) $assignment->required_hours;

        return $required > 0 ? max(0.0, round($required - (float) $assignment->verified_hours, 2)) : 0.0;
    }

    /** The moment a placement's term is over (end of its last day, Manila), if dated. */
    public static function termEndsAt(Assignment $assignment): ?Carbon
    {
        $end = $assignment->effectiveEndDate();

        return $end ? Carbon::parse($end->toDateString(), SemesterPeriod::TIMEZONE)->endOfDay() : null;
    }

    /** A deficiency marked during the term is re-measured once the term is over. */
    private function remeasure(Assignment $assignment): bool
    {
        $endsAt = self::termEndsAt($assignment);
        if (!$endsAt || !$assignment->term_status_at || $assignment->term_status_at->gte($endsAt) || now()->lte($endsAt)) {
            return false;
        }

        $this->apply($assignment, [
            'deficient_hours' => $this->shortfall($assignment),
            'term_status_at' => now(),
        ], 'term_closed', null);

        return true;
    }

    private function apply(Assignment $assignment, array $changes, string $action, ?int $userId): void
    {
        DB::transaction(function () use ($assignment, $changes, $action, $userId) {
            $old = $assignment->only(['term_status', 'deficient_hours']);
            $assignment->update($changes);
            AuditLog::record($action, $assignment, $old, $assignment->only(['term_status', 'deficient_hours', 'term_status_reason']), $userId);
        });
    }

    private function notify(Assignment $assignment, string $kind, ?string $reason = null): void
    {
        $data = [
            'user_id' => $assignment->user_id,
            'assignment_id' => $assignment->id,
            'kind' => $kind,
            'term' => "{$assignment->semester} {$assignment->academic_year}",
            'deficient_hours' => $assignment->deficient_hours !== null ? (float) $assignment->deficient_hours : null,
            'by_supervisor' => $assignment->term_status_by !== null,
            'reason' => $reason,
        ];

        DB::afterCommit(fn () => AfterCommit::quietly(
            fn () => SendApplicationNotificationJob::dispatch('term_status', $data)->onQueue('notifications'),
            'Term status notification',
            ['assignment_id' => $assignment->id],
        ));
    }
}
