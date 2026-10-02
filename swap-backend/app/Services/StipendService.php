<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\PromissoryNote;
use App\Models\StipendHistory;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class StipendService
{
    /** Fixed SWAP stipend per semester (PHP). Eligibility is semester-based. */
    public const DEFAULT_STIPEND_AMOUNT = 5000;

    /**
     * Terms that can still be paid: the current one, and one already rolled into the
     * next term by a renewal (a suspended placement is not paid).
     */
    public const PAYABLE_STATUSES = ['active', 'completed'];

    /**
     * Recipients who can be paid for an academic period: those whose assignment
     * met its required verified hours, PLUS short students whose promissory note
     * was approved for the period — minus anyone already paid.
     */
    public function eligibleRecipients(): array
    {
        $assignments = Assignment::with(['user.profile', 'termReport'])
            ->whereIn('status', self::PAYABLE_STATUSES)
            ->where('required_hours', '>', 0)
            ->withSum(['timeLogs as verified_sum' => fn ($q) => $q->where('status', 'verified')], 'duration_hours')
            ->get()
            ->filter(fn ($a) => (float) ($a->verified_sum ?? 0) >= (float) $a->required_hours);

        // Exclude anyone who already has a live stipend for the period (prepared,
        // certified, claimed, or legacy-released). A voided one frees them up again.
        $releasedKeys = StipendHistory::whereIn('status', ['pending', 'certified', 'claimed', 'released'])
            ->get(['user_id', 'academic_year', 'semester'])
            ->map(fn ($s) => "{$s->user_id}|{$s->academic_year}|{$s->semester}")
            ->flip();

        $standard = $assignments
            ->reject(fn ($a) => $releasedKeys->has("{$a->user_id}|{$a->academic_year}|{$a->semester}"))
            ->map(fn ($a) => [
                'user_id' => $a->user_id,
                'name' => $a->user->profile?->full_name ?? $a->user->name,
                'student_id_number' => $a->user->profile?->student_id_number,
                'academic_year' => $a->academic_year,
                'semester' => $a->semester,
                'required_hours' => (float) $a->required_hours,
                'verified_hours' => (float) ($a->verified_sum ?? 0),
                'suggested_amount' => self::DEFAULT_STIPEND_AMOUNT,
                'via_promissory' => false,
                'deficient_hours' => null,
            ] + self::readiness($a));

        return $standard
            ->concat($this->promissoryEligibleRecipients($releasedKeys))
            ->values()
            ->all();
    }

    /**
     * Short students (verified < required) whose promissory note was approved for
     * the period and who have not been paid yet. Flagged so the admin UI shows
     * the lacking-hours badge and the audit trail records the override.
     */
    private function promissoryEligibleRecipients(\Illuminate\Support\Collection $releasedKeys): \Illuminate\Support\Collection
    {
        return Assignment::with(['user.profile', 'promissoryNotes', 'termReport'])
            ->whereIn('status', self::PAYABLE_STATUSES)
            ->where('required_hours', '>', 0)
            ->withSum(['timeLogs as verified_sum' => fn ($q) => $q->where('status', 'verified')], 'duration_hours')
            ->whereHas('promissoryNotes', fn ($q) => $q->where('status', PromissoryNote::STATUS_APPROVED))
            ->get()
            ->filter(fn ($a) => (float) ($a->verified_sum ?? 0) < (float) $a->required_hours)
            ->reject(fn ($a) => $releasedKeys->has("{$a->user_id}|{$a->academic_year}|{$a->semester}"))
            ->map(function ($a) {
                $note = $a->promissoryNotes
                    ->where('status', PromissoryNote::STATUS_APPROVED)
                    ->where('academic_year', $a->academic_year)
                    ->where('semester', $a->semester)
                    ->sortByDesc('id')
                    ->first();

                if (!$note) {
                    return null;
                }

                return [
                    'user_id' => $a->user_id,
                    'name' => $a->user->profile?->full_name ?? $a->user->name,
                    'student_id_number' => $a->user->profile?->student_id_number,
                    'academic_year' => $a->academic_year,
                    'semester' => $a->semester,
                    'required_hours' => (float) $a->required_hours,
                    'verified_hours' => (float) ($a->verified_sum ?? 0),
                    'suggested_amount' => self::DEFAULT_STIPEND_AMOUNT,
                    'via_promissory' => true,
                    'promissory_id' => $note->id,
                    // The term's shortfall: its recorded verdict, else the note's.
                    'deficient_hours' => (float) ($a->deficient_hours
                        ?? $note->deficient_hours
                        ?? max(0, (float) $a->required_hours - (float) ($a->verified_sum ?? 0))),
                    'lacking_hours' => (float) $note->lacking_hours,
                    'makeup_deadline' => $note->makeup_deadline?->toDateString(),
                ] + self::readiness($a);
            })
            ->filter()
            ->values();
    }

    /**
     * What the release still needs from the recipient besides hours: their saved
     * signature (it signs the stub) and the end-of-term report. Listed, not
     * filtered, so the admin sees who is held back and why.
     */
    private static function readiness(Assignment $a): array
    {
        return [
            'assignment_id' => $a->id,
            'has_signature' => !empty($a->user->signature_image_path),
            'narrative_submitted' => $a->termReport?->submitted_at !== null,
        ];
    }

    public function getHistory(User $user, int $perPage = 15): LengthAwarePaginator
    {
        return StipendHistory::where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    public function paginateAll(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = StipendHistory::with(['recipient.profile', 'releasedBy'])
            ->orderByDesc('created_at');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['academic_year'])) {
            $query->where('academic_year', $filters['academic_year']);
        }

        // Name, email, student ID or control number.
        if (!empty($filters['search'])) {
            $term = '%' . trim($filters['search']) . '%';
            $query->where(fn ($q) => $q
                ->where('control_number', 'ilike', $term)
                ->orWhereHas('recipient', fn ($u) => $u
                    ->where('name', 'ilike', $term)
                    ->orWhere('email', 'ilike', $term)
                    ->orWhereHas('profile', fn ($p) => $p->where('student_id_number', 'ilike', $term))));
        }

        return $query->paginate($perPage);
    }
}
