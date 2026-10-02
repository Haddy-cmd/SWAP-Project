<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;
use App\Services\SemesterPeriodService;

class Assignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'office_id',
        'supervisor_id',
        'academic_year',
        'semester',
        'required_hours',
        'pending_required_hours',
        'pending_required_by',
        'start_date',
        'end_date',
        'status',
        'qr_code',
        'qr_secret',
        'term_status',
        'deficient_hours',
        'term_status_at',
        'term_status_by',
        'term_status_reason',
        'carried_over_hours',
        'carried_from_assignment_id',
    ];

    // Persisted end-of-term verdict (TermStatusService); null while in progress.
    public const TERM_QUALIFIED = 'qualified';
    public const TERM_DEFICIENT = 'deficient';

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'required_hours' => 'integer',
            'pending_required_hours' => 'integer',
            'deficient_hours' => 'decimal:2',
            'term_status_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function timeLogs(): HasMany
    {
        return $this->hasMany(TimeLog::class);
    }

    /** The term whose unfinished promissory makeup hours were added to this one. */
    public function carriedFrom(): BelongsTo
    {
        return $this->belongsTo(self::class, 'carried_from_assignment_id');
    }

    /** The term's own requirement, without hours carried in from the previous term. */
    public function baseRequiredHours(): int
    {
        return max(0, (int) $this->required_hours - (int) $this->carried_over_hours);
    }

    /** The supervisor's end-of-term evaluation (TermEvaluationService). */
    public function evaluation(): HasOne
    {
        return $this->hasOne(TermEvaluation::class);
    }

    public function promissoryNotes(): HasMany
    {
        return $this->hasMany(PromissoryNote::class);
    }

    /** The end-of-term narrative report (required before the stipend is released). */
    public function termReport(): HasOne
    {
        return $this->hasOne(TermReport::class);
    }

    /**
     * Assignments this supervisor may manage: the ones assigned to them directly,
     * plus — when they belong to an office — every assignment hosted at that
     * office, so co-supervisors of one office share the same students.
     */
    public function scopeVisibleToSupervisor(Builder $query, User $supervisor): Builder
    {
        return $query->where(function (Builder $q) use ($supervisor) {
            $q->where('supervisor_id', $supervisor->id);
            if ($supervisor->office_id !== null) {
                $q->orWhere('office_id', $supervisor->office_id);
            }
        });
    }

    /**
     * The supervisors who oversee this assignment: the one assigned directly,
     * plus every supervisor of the host office. Mirrors visibleToSupervisor(),
     * so anyone who can see this student in their roster also governs the
     * settings that apply to them.
     */
    public function governingSupervisors(): \Illuminate\Support\Collection
    {
        // List pages eager-load supervisor + office.supervisors: answer from those
        // instead of one query per row. Same set as the query below.
        $officeLoaded = $this->office_id === null
            || ($this->relationLoaded('office') && $this->office?->relationLoaded('supervisors'));
        if ($this->relationLoaded('supervisor') && $officeLoaded) {
            return collect([$this->supervisor])
                ->filter(fn ($u) => $u && $u->role === 'supervisor')
                ->merge($this->office?->supervisors ?? [])
                ->unique('id')
                ->values();
        }

        return User::query()
            ->where('role', 'supervisor')
            ->where(function (Builder $q) {
                $q->where('id', $this->supervisor_id);
                if ($this->office_id !== null) {
                    $q->orWhere('office_id', $this->office_id);
                }
            })
            ->get();
    }

    /**
     * How far below the expected pace a student may fall before we call them behind.
     * A little slack absorbs the normal rhythm of a semester — a quiet exam week
     * shouldn't light up the supervisor's dashboard.
     */
    private const PACE_GRACE = 0.9;

    /** Memoised so paceStatus() and remaining_hours don't each re-query the sum. */
    private ?float $verifiedHoursMemo = null;

    public function getRenderedHoursAttribute(): float
    {
        // Preloaded by withSum() on list queries (AssignmentRepository::paginate).
        if (array_key_exists('rendered_sum', $this->attributes)) {
            return (float) $this->attributes['rendered_sum'];
        }

        return (float) $this->timeLogs()
            ->whereNotNull('time_out')
            ->sum('duration_hours');
    }

    public function getVerifiedHoursAttribute(): float
    {
        // Preloaded by withSum() on roster/report queries; single models fall back to a query.
        if (array_key_exists('verified_sum', $this->attributes)) {
            return (float) $this->attributes['verified_sum'];
        }

        return $this->verifiedHoursMemo ??= (float) $this->timeLogs()
            ->where('status', 'verified')
            ->sum('duration_hours');
    }

    public function getPendingHoursAttribute(): float
    {
        if (array_key_exists('pending_sum', $this->attributes)) {
            return (float) $this->attributes['pending_sum'];
        }

        return (float) $this->timeLogs()
            ->where('status', 'pending_verification')
            ->sum('duration_hours');
    }

    public function getRemainingHoursAttribute(): float
    {
        return max(0, $this->required_hours - $this->verified_hours);
    }

    /**
     * Where the student stands against the calendar, not just against the total.
     * A student at 40% is fine in October and in trouble in December, so pace is
     * measured as verified hours against the hours the elapsed term implies.
     *
     * Lives on the model so the roster, the student page and the CSV export all
     * read the same rule rather than each re-deriving it.
     *
     * @return array{status:string,percent:float,expected_hours:?float,deficit_hours:?float}
     */
    public function paceStatus(): array
    {
        $required = (float) $this->required_hours;
        $verified = $this->verified_hours;
        $percent = $required > 0 ? min(100.0, round($verified / $required * 100, 1)) : 0.0;

        $result = fn (string $status, ?float $expected = null, ?float $deficit = null) => [
            'status' => $status,
            'percent' => $percent,
            'expected_hours' => $expected,
            'deficit_hours' => $deficit,
        ];

        if ($required <= 0) {
            return $result('on_track');
        }

        if ($verified >= $required) {
            return $result('complete', $required, 0.0);
        }

        $elapsed = $this->elapsedFraction();

        // Without both dates there's no deadline to measure against, so fall back to
        // the flat threshold the student detail page has always used.
        if ($elapsed === null) {
            return $result($verified <= 0 ? 'not_started' : ($percent < 25 ? 'behind' : 'on_track'));
        }

        $expected = round($required * $elapsed, 2);

        // The term hasn't meaningfully started; nothing is expected of them yet.
        if ($expected <= 0) {
            return $result($verified <= 0 ? 'not_started' : 'on_track', 0.0, 0.0);
        }

        $behind = $verified < $expected * self::PACE_GRACE;

        return $result($behind ? 'behind' : 'on_track', $expected, $behind ? round($expected - $verified, 2) : 0.0);
    }

    /**
     * The term's badge: qualified, deficient (with or without a promissory note) or
     * in_progress. List queries preload the note flags (withPromissoryFlags) so only
     * single models fall back to a query, and only when the term is deficient.
     *
     * @return 'qualified'|'promissory_approved'|'promissory_pending'|'deficient'|'in_progress'
     */
    public function termBadge(): string
    {
        if ($this->term_status === self::TERM_QUALIFIED) {
            return 'qualified';
        }
        if ($this->term_status !== self::TERM_DEFICIENT) {
            return 'in_progress';
        }

        $has = fn (string $status, string $attr) => array_key_exists($attr, $this->attributes)
            ? (bool) $this->attributes[$attr]
            : $this->promissoryNotes()->where('status', $status)->exists();

        return match (true) {
            $has(PromissoryNote::STATUS_APPROVED, 'has_approved_promissory') => 'promissory_approved',
            $has(PromissoryNote::STATUS_PENDING, 'has_pending_promissory') => 'promissory_pending',
            default => 'deficient',
        };
    }

    /** Preload the flags termBadge() reads. */
    public function scopeWithPromissoryFlags(Builder $query): Builder
    {
        return $query->withExists([
            'promissoryNotes as has_approved_promissory' => fn ($q) => $q->where('status', PromissoryNote::STATUS_APPROVED),
            'promissoryNotes as has_pending_promissory' => fn ($q) => $q->where('status', PromissoryNote::STATUS_PENDING),
        ]);
    }

    /** The DSA semester period this assignment's term belongs to, if it was set up. */
    public function semesterPeriod(): ?SemesterPeriod
    {
        return app(SemesterPeriodService::class)->forTerm($this->academic_year, $this->semester);
    }

    /**
     * The term's last day: the assignment's own end date (a per-placement override),
     * else its semester period's end date. Drives pace, the promissory window and the
     * end-of-term job.
     */
    public function effectiveEndDate(): ?Carbon
    {
        return $this->end_date ?? $this->semesterPeriod()?->end_date;
    }

    /** Fraction of the placement window already elapsed (0–1), or null if undated. */
    private function elapsedFraction(): ?float
    {
        $endDate = $this->effectiveEndDate();
        if (!$this->start_date || !$endDate) {
            return null;
        }

        $start = $this->start_date->copy()->startOfDay()->getTimestamp();
        $end = $endDate->copy()->endOfDay()->getTimestamp();

        if ($end <= $start) {
            return null;
        }

        return max(0.0, min(1.0, (now()->getTimestamp() - $start) / ($end - $start)));
    }
}
