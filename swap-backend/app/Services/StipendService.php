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
                'college' => $a->user->profile?->college,
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
                    'college' => $a->user->profile?->college,
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
        return $this->historyQuery($filters)->paginate($perPage);
    }

    /**
     * Admin → Stipend → History rows (list and CSV): the filters, the status chip and the sort.
     */
    public function historyQuery(array $filters = []): \Illuminate\Database\Eloquent\Builder
    {
        $query = $this->filtered($filters)->with(['recipient.profile', 'releasedBy']);

        // Legacy stubs may lack released_at; they fall back to when they were made.
        match ($filters['sort'] ?? 'new') {
            'old' => $query->orderByRaw('COALESCE(released_at, created_at) ASC')->orderBy('id'),
            'amount' => $query->orderByDesc('amount')->orderByDesc('id'),
            'name' => $query->orderBy(User::select('name')->whereColumn('users.id', 'stipend_history.user_id'))->orderByDesc('id'),
            default => $query->orderByRaw('COALESCE(released_at, created_at) DESC')->orderByDesc('id'),
        };

        match ($filters['status'] ?? null) {
            // Every paid stub: released (legacy ready-to-claim certified/pending included) and legacy received.
            StipendHistory::STATUS_RELEASED => $query->whereIn('status', [...self::RELEASED_STATUSES, StipendHistory::STATUS_CLAIMED]),
            // The recipient opened it (or, before 2026-10-05, collected it at the Banking Office).
            'received' => $query->where(fn ($q) => $q->where('status', StipendHistory::STATUS_CLAIMED)
                ->orWhere(fn ($r) => $r->whereIn('status', self::RELEASED_STATUSES)->whereNotNull('received_at'))),
            'not_received' => $query->whereIn('status', self::RELEASED_STATUSES)->whereNull('received_at'),
            null, '' => null,
            default => $query->where('status', $filters['status']),
        };

        return $query;
    }

    /** Statuses that count as released (a release is final; certified/pending are legacy). */
    public const RELEASED_STATUSES = ['released', 'certified', 'pending'];

    /**
     * Admin → Stipend → History cards and chip counts, over the same term/search as the list
     * (the status chip doesn't narrow them): money paid out (every live stub), and counts.
     * `received` = opened by the recipient (received_at) or legacy Banking Office pickup.
     *
     * @return array{paid_out: float, released: int, received: int, not_received: int, legacy_received: int, void: int}
     */
    public function summary(array $filters = []): array
    {
        $rows = $this->filtered($filters)
            ->selectRaw('status, (received_at IS NOT NULL) as opened, COUNT(*) as n, COALESCE(SUM(amount), 0) as total')
            ->groupBy('status', 'opened')->get();
        $count = fn (callable $match) => (int) $rows->filter($match)->sum('n');
        $released = fn ($r) => in_array($r->status, self::RELEASED_STATUSES, true);

        return [
            'paid_out' => round((float) $rows->where('status', '!=', StipendHistory::STATUS_VOID)->sum('total'), 2),
            'released' => $count(fn ($r) => $released($r) || $r->status === StipendHistory::STATUS_CLAIMED),
            'received' => $count(fn ($r) => ($released($r) && $r->opened) || $r->status === StipendHistory::STATUS_CLAIMED),
            'not_received' => $count(fn ($r) => $released($r) && !$r->opened),
            'legacy_received' => $count(fn ($r) => $r->status === StipendHistory::STATUS_CLAIMED),
            'void' => $count(fn ($r) => $r->status === StipendHistory::STATUS_VOID),
        ];
    }

    /**
     * The terms the Stipend page's Term filter offers: any with a stub or a payable placement,
     * newest first (within a year: 2nd Semester, Summer, 1st Semester).
     *
     * @return list<array{academic_year: string, semester: string}>
     */
    public function terms(): array
    {
        $pairs = StipendHistory::query()->select('academic_year', 'semester')
            ->union(Assignment::query()->select('academic_year', 'semester')->whereIn('status', self::PAYABLE_STATUSES));

        return \Illuminate\Support\Facades\DB::query()->fromSub($pairs, 't')
            ->whereNotNull('academic_year')->whereNotNull('semester')
            ->orderByDesc('academic_year')
            ->orderByRaw("CASE semester WHEN '2nd Semester' THEN 1 WHEN 'Summer' THEN 2 WHEN '1st Semester' THEN 3 ELSE 4 END")
            ->get()
            ->map(fn ($t) => ['academic_year' => $t->academic_year, 'semester' => $t->semester])
            ->all();
    }

    /** Stubs narrowed by term, college, promissory, and by name, email, student ID or control number. */
    private function filtered(array $filters): \Illuminate\Database\Eloquent\Builder
    {
        $query = StipendHistory::query();

        if (!empty($filters['academic_year'])) {
            $query->where('academic_year', $filters['academic_year']);
        }
        if (!empty($filters['semester'])) {
            $query->where('semester', $filters['semester']);
        }
        if (!empty($filters['college'])) {
            $query->whereHas('recipient.profile', fn ($p) => $p->where('college', $filters['college']));
        }
        if (filter_var($filters['promissory'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $query->where('via_promissory', true);
        }

        if (!empty($filters['search'])) {
            $term = '%' . trim($filters['search']) . '%';
            $query->where(fn ($q) => $q
                ->where('control_number', 'ilike', $term)
                ->orWhereHas('recipient', fn ($u) => $u
                    ->where('name', 'ilike', $term)
                    ->orWhere('email', 'ilike', $term)
                    ->orWhereHas('profile', fn ($p) => $p->where('student_id_number', 'ilike', $term))));
        }

        return $query;
    }
}
