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
     * Recipients who can be paid for an academic period: those whose active
     * assignment met its required verified hours, PLUS short students whose
     * promissory note was approved for the period — minus anyone already paid.
     */
    public function eligibleRecipients(): array
    {
        $assignments = Assignment::with('user.profile')
            ->where('status', 'active')
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
                'academic_year' => $a->academic_year,
                'semester' => $a->semester,
                'required_hours' => (float) $a->required_hours,
                'verified_hours' => (float) ($a->verified_sum ?? 0),
                'suggested_amount' => self::DEFAULT_STIPEND_AMOUNT,
                'via_promissory' => false,
            ]);

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
        return Assignment::with(['user.profile', 'promissoryNotes'])
            ->where('status', 'active')
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
                    'academic_year' => $a->academic_year,
                    'semester' => $a->semester,
                    'required_hours' => (float) $a->required_hours,
                    'verified_hours' => (float) ($a->verified_sum ?? 0),
                    'suggested_amount' => self::DEFAULT_STIPEND_AMOUNT,
                    'via_promissory' => true,
                    'promissory_id' => $note->id,
                    'lacking_hours' => (float) $note->lacking_hours,
                    'makeup_deadline' => $note->makeup_deadline?->toDateString(),
                ];
            })
            ->filter()
            ->values();
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

        return $query->paginate($perPage);
    }

    public function getSummary(string $academicYear, string $semester): array
    {
        $released = StipendHistory::where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->where('status', 'released')
            ->sum('amount');

        $pending = StipendHistory::where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->where('status', 'pending')
            ->sum('amount');

        return [
            'total_released' => (float) $released,
            'total_pending' => (float) $pending,
        ];
    }
}
