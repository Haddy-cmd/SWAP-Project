<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'required_hours' => 'integer',
            'pending_required_hours' => 'integer',
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
     * How far below the expected pace a student may fall before we call them behind.
     * A little slack absorbs the normal rhythm of a semester — a quiet exam week
     * shouldn't light up the supervisor's dashboard.
     */
    private const PACE_GRACE = 0.9;

    /** Memoised so paceStatus() and remaining_hours don't each re-query the sum. */
    private ?float $verifiedHoursMemo = null;

    public function getRenderedHoursAttribute(): float
    {
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

    /** Fraction of the placement window already elapsed (0–1), or null if undated. */
    private function elapsedFraction(): ?float
    {
        if (!$this->start_date || !$this->end_date) {
            return null;
        }

        $start = $this->start_date->copy()->startOfDay()->getTimestamp();
        $end = $this->end_date->copy()->endOfDay()->getTimestamp();

        if ($end <= $start) {
            return null;
        }

        return max(0.0, min(1.0, (now()->getTimestamp() - $start) / ($end - $start)));
    }
}
