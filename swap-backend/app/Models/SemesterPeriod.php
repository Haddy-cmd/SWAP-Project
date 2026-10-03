<?php

namespace App\Models;

use App\Services\SemesterPeriodService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/** One term on the DSA's semester calendar (see SemesterPeriodService). */
class SemesterPeriod extends Model
{
    public const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'];
    public const TIMEZONE = 'Asia/Manila';

    protected $fillable = [
        'academic_year',
        'semester',
        'start_date',
        'end_date',
        'renewal_open',
        'renewal_closed_at',
        'closed_at',
        'created_by',
    ];

    protected static function booted(): void
    {
        // Any change to the calendar invalidates the memoised lookup.
        $flush = fn () => app()->resolved(SemesterPeriodService::class) && app(SemesterPeriodService::class)->flush();
        static::saved($flush);
        static::deleted($flush);
    }

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'renewal_open' => 'boolean',
            'renewal_closed_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    /** "1st Semester 2026-2027" — the label used in messages. */
    public function label(): string
    {
        return "{$this->semester} {$this->academic_year}";
    }

    /** upcoming | current | ended, judged by the Manila calendar day. */
    public function phase(?Carbon $today = null): string
    {
        $today ??= Carbon::now(self::TIMEZONE)->startOfDay();
        $start = Carbon::parse($this->start_date->toDateString(), self::TIMEZONE);
        $end = Carbon::parse($this->end_date->toDateString(), self::TIMEZONE);

        return match (true) {
            $today->lt($start) => 'upcoming',
            $today->gt($end) => 'ended',
            default => 'current',
        };
    }
}
