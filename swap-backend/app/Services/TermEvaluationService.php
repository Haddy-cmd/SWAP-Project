<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\TermEvaluation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * The supervisor's end-of-term evaluation (1–5, 3+ passes). Any governing
 * supervisor of the placement may write it while the placement is current;
 * renewal approval reads it (RenewalReadinessService).
 */
class TermEvaluationService
{
    public const MSG_NOT_ACTIVE = 'This placement has ended, so its evaluation can no longer be changed.';

    /** How close to its end a term counts as "evaluation due" on the supervisor's dashboard. */
    public const DUE_WITHIN_DAYS = 14;

    public function find(Assignment $assignment, User $supervisor): ?TermEvaluation
    {
        $this->assertGoverns($assignment, $supervisor);

        return $assignment->evaluation()->with('evaluator')->first();
    }

    public function save(Assignment $assignment, User $supervisor, int $rating, string $remarks): TermEvaluation
    {
        $this->assertGoverns($assignment, $supervisor);
        if ($assignment->status !== 'active') {
            throw new UnprocessableEntityHttpException(self::MSG_NOT_ACTIVE);
        }

        return DB::transaction(function () use ($assignment, $supervisor, $rating, $remarks) {
            $existing = $assignment->evaluation()->first();
            $old = $existing?->only(['rating', 'passed', 'remarks']);

            $evaluation = TermEvaluation::updateOrCreate(
                ['assignment_id' => $assignment->id],
                [
                    'evaluator_id' => $supervisor->id,
                    'rating' => $rating,
                    'remarks' => $remarks,
                    'passed' => $rating >= TermEvaluation::PASSING_RATING,
                ],
            );

            AuditLog::record('term_evaluated', $evaluation, $old, $evaluation->only(['rating', 'passed', 'remarks']), $supervisor->id);

            return $evaluation->load('evaluator');
        });
    }

    /** Not yet evaluated, and the term ends within DUE_WITHIN_DAYS (or already has). */
    public static function isDue(Assignment $assignment, bool $hasEvaluation): bool
    {
        if ($hasEvaluation || $assignment->status !== 'active') {
            return false;
        }
        $end = $assignment->effectiveEndDate();

        return $end !== null
            && $end->toDateString() <= SemesterPeriodService::today()->addDays(self::DUE_WITHIN_DAYS)->toDateString();
    }

    private function assertGoverns(Assignment $assignment, User $supervisor): void
    {
        if (!$assignment->governingSupervisors()->contains('id', $supervisor->id)) {
            throw new NotFoundHttpException('Student not found or not assigned to you.');
        }
    }
}
