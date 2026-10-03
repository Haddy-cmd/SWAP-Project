<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Assignment;
use App\Models\PromissoryNote;
use App\Models\StipendHistory;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * What approving a renewal requires, checked in order:
 *   0. the renewal carries the recipient's updated COR, and there is an earlier
 *      placement to renew;
 *   1. the renewed term is paid, or covered by an approved promissory note;
 *   2. the end-of-term report is in;
 *   3. hours completed: the supervisor accepted the report and marked the student
 *      eligible for renewal. Hours short: the approved note and the report are enough —
 *      the lacking hours are added to the next term (carryHours) — unless the supervisor
 *      accepted the report and marked the student not eligible.
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

    public static function msgNotAccepted(string $term): string
    {
        return "The supervisor hasn't accepted the end-of-term report for {$term} yet.";
    }

    public static function msgNotEligible(string $term): string
    {
        return "The supervisor marked this recipient not eligible for renewal for {$term}.";
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

    /**
     * Unfinished promissory makeup hours that move into the next term at rollover:
     * the remaining shortfall of a term covered by an approved note, in whole hours.
     */
    public function carryHours(Assignment $previous): int
    {
        $covered = PromissoryNote::where('assignment_id', $previous->id)
            ->where('status', PromissoryNote::STATUS_APPROVED)->exists();

        return $covered ? (int) ceil($this->termStatus->shortfall($previous)) : 0;
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
        $previous->loadMissing(['termReport.reviewer']);
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

        $report = $previous->termReport;
        $reportIn = $report?->submitted_at !== null;
        $accepted = $report?->reviewed_at !== null;
        // Completed (or no requirement): the supervisor's acceptance decides. Short: the
        // approved note (checked as payment above) and the report are enough.
        $hoursMet = $required <= 0 || $met;

        $blocker = match (true) {
            !$corAttached => self::MSG_NO_COR,
            $payment === 'owed' => self::msgOwed($term),
            $payment === 'unpaid' => self::msgUnpaid($term),
            !$reportIn => self::msgNoReport($term),
            $hoursMet && !$accepted => self::msgNotAccepted($term),
            // A "not eligible" mark blocks anyone the supervisor marked, short or not.
            $accepted && !$report->renewal_eligible => self::msgNotEligible($term),
            default => null,
        };

        return [
            'term' => $term,
            'cor_attached' => $corAttached,
            // Added to the next term's requirement when this renewal is approved.
            'carry_hours' => $this->carryHours($previous),
            'term_status' => $previous->term_status,
            'deficient_hours' => $previous->deficient_hours !== null
                ? (float) $previous->deficient_hours
                : ($met ? null : $this->termStatus->shortfall($previous)),
            'payment' => $payment,
            'promissory_note_id' => $note?->id,
            'hours_met' => $hoursMet,
            'report_submitted' => $reportIn,
            // The supervisor's acceptance of the end-of-term report (needed when hours were met).
            'report' => [
                'submitted' => $reportIn,
                'accepted' => $accepted,
                'renewal_eligible' => $accepted ? (bool) $report->renewal_eligible : null,
                'reviewer' => $report?->reviewer?->name,
                'remarks' => $report?->review_remarks,
            ],
            'ready' => $blocker === null,
            'blocker' => $blocker,
        ];
    }
}
