<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Assignment;
use App\Models\PromissoryNote;
use App\Models\StipendHistory;
use App\Models\TermEvaluation;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * What approving a renewal requires, checked in order:
 *   0. the renewal carries the recipient's updated COR, and there is an earlier
 *      placement to renew;
 *   1. the renewed term is paid, or covered by an approved promissory note;
 *   2. if covered but not yet paid, the end-of-term report is in (the stub can't
 *      be released without it, and it can't be written once the term rolls over);
 *   3. the supervisor evaluated the term and it passed (3+ of 5);
 *   4. no approved note's makeup deadline has passed with hours still short.
 * Submitting a renewal stays open early; only the approval waits for these.
 */
class RenewalReadinessService
{
    public function __construct(private readonly TermStatusService $termStatus) {}

    public const MSG_NO_COR = 'This renewal has no updated COR attached. The recipient has to submit the renewal with their COR first.';
    public const MSG_NO_PREVIOUS = 'This recipient has no earlier assignment to renew.';

    public static function msgOwed(string $term): string
    {
        return "Release this recipient's stipend for {$term} before approving the renewal.";
    }

    public static function msgUnpaid(string $term): string
    {
        return "This recipient's {$term} is not paid and has no approved promissory note.";
    }

    public static function msgNoReport(string $term): string
    {
        return "This recipient has not submitted their end-of-term narrative report for {$term} yet.";
    }

    public static function msgNotEvaluated(string $term): string
    {
        return "The supervisor has not evaluated this recipient for {$term} yet.";
    }

    public static function msgFailed(string $term, int $rating): string
    {
        return "This recipient did not pass the supervisor evaluation for {$term} (rating {$rating}/5).";
    }

    public static function msgMakeupOverdue(string $term, Carbon $due): string
    {
        return "This recipient's makeup hours for {$term} were due {$due->format('M j, Y')} and are not complete.";
    }

    /** The term a renewal application renews: the student's latest other assignment. */
    public function previousAssignment(Application $application): ?Assignment
    {
        return Assignment::where('user_id', $application->user_id)
            ->where(fn ($q) => $q->where('academic_year', '!=', $application->academic_year)
                ->orWhere('semester', '!=', $application->semester))
            ->orderByDesc('id')
            ->first();
    }

    /** 409 with the first unmet requirement. */
    public function assertReady(Application $application): void
    {
        if (!self::hasCor($application)) {
            throw new ConflictHttpException(self::MSG_NO_COR);
        }

        $report = $this->check($application);
        if (!$report) {
            throw new ConflictHttpException(self::MSG_NO_PREVIOUS);
        }
        if ($report['blocker']) {
            throw new ConflictHttpException($report['blocker']);
        }
    }

    /** A renewal is submitted with the recipient's updated COR (ApplicationService::submitRenewal). */
    public static function hasCor(Application $application): bool
    {
        return $application->documents()->where('document_type', 'cor')->exists();
    }

    /**
     * The renewed term's record for the admin's review, with the first blocker
     * (null = ready). Null when the student has no earlier assignment.
     */
    public function check(Application $application): ?array
    {
        $previous = $this->previousAssignment($application);
        if (!$previous) {
            return null;
        }
        $previous->loadMissing(['termReport', 'evaluation.evaluator']);
        $corAttached = self::hasCor($application);

        $term = "{$previous->semester} {$previous->academic_year}";
        $required = (float) $previous->required_hours;
        $verified = (float) $previous->verified_hours;
        $met = $required > 0 && $verified >= $required;
        $payable = in_array($previous->status, StipendService::PAYABLE_STATUSES, true);

        $paid = StipendHistory::where('user_id', $previous->user_id)
            ->where('academic_year', $previous->academic_year)
            ->where('semester', $previous->semester)
            ->whereIn('status', ['pending', 'certified', 'claimed', 'released'])
            ->exists();

        $note = PromissoryNote::where('assignment_id', $previous->id)
            ->where('status', PromissoryNote::STATUS_APPROVED)
            ->latest('id')
            ->first();

        // paid | not_required | owed (met, not paid) | promissory (covered, not paid yet) | unpaid
        $payment = match (true) {
            $paid => 'paid',
            $required <= 0 => 'not_required',
            $met && $payable => 'owed',
            $note !== null && $payable => 'promissory',
            default => 'unpaid',
        };

        $reportIn = $previous->termReport?->submitted_at !== null;
        $evaluation = $previous->evaluation;

        $makeupDue = $note?->makeup_deadline
            ? Carbon::parse($note->makeup_deadline->toDateString(), 'Asia/Manila')->endOfDay()
            : null;
        $makeupOverdue = $makeupDue !== null && !$met && Carbon::now('Asia/Manila')->gt($makeupDue);

        $blocker = match (true) {
            !$corAttached => self::MSG_NO_COR,
            $payment === 'owed' => self::msgOwed($term),
            $payment === 'unpaid' => self::msgUnpaid($term),
            $payment === 'promissory' && !$reportIn => self::msgNoReport($term),
            $evaluation === null => self::msgNotEvaluated($term),
            !$evaluation->passed => self::msgFailed($term, $evaluation->rating),
            $makeupOverdue => self::msgMakeupOverdue($term, $makeupDue),
            default => null,
        };

        return [
            'term' => $term,
            'cor_attached' => $corAttached,
            'term_status' => $previous->term_status,
            'deficient_hours' => $previous->deficient_hours !== null
                ? (float) $previous->deficient_hours
                : ($met ? null : $this->termStatus->shortfall($previous)),
            'payment' => $payment,
            'promissory_note_id' => $note?->id,
            'makeup_deadline' => $note?->makeup_deadline?->toDateString(),
            'makeup_overdue' => $makeupOverdue,
            'report_submitted' => $reportIn,
            'evaluation' => $evaluation?->toPayload(),
            'passing_rating' => TermEvaluation::PASSING_RATING,
            'ready' => $blocker === null,
            'blocker' => $blocker,
        ];
    }
}
