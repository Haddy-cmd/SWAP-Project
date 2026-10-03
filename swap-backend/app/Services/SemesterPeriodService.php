<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\SemesterPeriod;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * The DSA's semester calendar: which term is current, when a term ends, and which
 * term renewal is open for. Every date rule reads from here (assignment dates are
 * per-placement overrides on top).
 */
class SemesterPeriodService
{
    public const MSG_IN_USE = 'Assignments or applications already use this semester, so it cannot be deleted. Edit its dates instead.';
    public const MSG_RENAME_IN_USE = "Students are already placed in this semester, so its school year and semester can't change. Add a new semester instead.";
    public const MSG_CLOSED_DATES = "This semester has been closed and its results recorded, so its dates can't change.";

    /**
     * @var ?array<string, SemesterPeriod> every period keyed "year|semester", loaded
     * once (the calendar is a handful of rows) so a list of assignments costs one
     * query. Forgotten after each request and whenever a period is saved/deleted.
     */
    private ?array $byTerm = null;

    public function forTerm(?string $academicYear, ?string $semester): ?SemesterPeriod
    {
        if (!$academicYear || !$semester) {
            return null;
        }

        $this->byTerm ??= SemesterPeriod::all()->keyBy(fn (SemesterPeriod $p) => "{$p->academic_year}|{$p->semester}")->all();

        return $this->byTerm["{$academicYear}|{$semester}"] ?? null;
    }

    /** Forget the memoised calendar. */
    public function flush(): void
    {
        $this->byTerm = null;
    }

    public static function today(): Carbon
    {
        return Carbon::now(SemesterPeriod::TIMEZONE)->startOfDay();
    }

    /** The period whose dates include today (Manila), if any. Periods never overlap. */
    public function current(): ?SemesterPeriod
    {
        $today = self::today()->toDateString();

        return SemesterPeriod::where('start_date', '<=', $today)->where('end_date', '>=', $today)->first();
    }

    /** The next period that hasn't started yet. */
    public function next(): ?SemesterPeriod
    {
        return SemesterPeriod::where('start_date', '>', self::today()->toDateString())->orderBy('start_date')->first();
    }

    /**
     * The term new applications are for: the current semester, or — between semesters —
     * the next one. Applicants don't choose it.
     */
    public function applicationTerm(): ?SemesterPeriod
    {
        return $this->current() ?? $this->next();
    }

    /** The one period renewal is open for, if any. */
    public static function renewalTarget(): ?SemesterPeriod
    {
        return SemesterPeriod::where('renewal_open', true)->orderBy('start_date')->first();
    }

    /** @return Collection<int, SemesterPeriod> newest first */
    public function all(): Collection
    {
        return SemesterPeriod::orderByDesc('start_date')->get();
    }

    public function create(array $data, User $admin): SemesterPeriod
    {
        return DB::transaction(function () use ($data, $admin) {
            $period = SemesterPeriod::create($data + ['created_by' => $admin->id]);
            AuditLog::record('semester_period_created', $period, null, $period->only(['academic_year', 'semester', 'start_date', 'end_date', 'renewal_open']), $admin->id);

            return $period->fresh();
        });
    }

    /**
     * Who uses this term. Placements and applications point to a semester by its school
     * year + semester text, so a used semester can't be renamed or deleted.
     *
     * @return array{assignments: int, applications: int}
     */
    public function usage(SemesterPeriod $period): array
    {
        return [
            'assignments' => Assignment::where('academic_year', $period->academic_year)->where('semester', $period->semester)->count(),
            'applications' => Application::where('academic_year', $period->academic_year)->where('semester', $period->semester)->count(),
        ];
    }

    public static function inUse(array $usage): bool
    {
        return $usage['assignments'] + $usage['applications'] > 0;
    }

    public function update(SemesterPeriod $period, array $data, User $admin): SemesterPeriod
    {
        $renamed = ($data['academic_year'] ?? $period->academic_year) !== $period->academic_year
            || ($data['semester'] ?? $period->semester) !== $period->semester;
        if ($renamed && self::inUse($this->usage($period))) {
            throw new UnprocessableEntityHttpException(self::MSG_RENAME_IN_USE);
        }

        // Once closed, the recorded Qualified/Deficient results were computed from these dates.
        $redated = (isset($data['start_date']) && Carbon::parse($data['start_date'])->toDateString() !== $period->start_date->toDateString())
            || (isset($data['end_date']) && Carbon::parse($data['end_date'])->toDateString() !== $period->end_date->toDateString());
        if ($redated && $period->closed_at !== null) {
            throw new UnprocessableEntityHttpException(self::MSG_CLOSED_DATES);
        }

        return DB::transaction(function () use ($period, $data, $admin) {
            $old = $period->only(['academic_year', 'semester', 'start_date', 'end_date', 'renewal_open']);
            // Closing renewal also closes the promissory-note window of the term before it.
            if (array_key_exists('renewal_open', $data) && (bool) $data['renewal_open'] !== $period->renewal_open) {
                $data['renewal_closed_at'] = $data['renewal_open'] ? null : now();
            }
            $period->update($data);
            AuditLog::record('semester_period_updated', $period, $old, $period->only(['academic_year', 'semester', 'start_date', 'end_date', 'renewal_open']), $admin->id);

            return $period->fresh();
        });
    }

    public function delete(SemesterPeriod $period, User $admin): void
    {
        if (self::inUse($this->usage($period))) {
            throw new UnprocessableEntityHttpException(self::MSG_IN_USE);
        }

        AuditLog::record('semester_period_deleted', $period, $period->only(['academic_year', 'semester', 'start_date', 'end_date']), null, $admin->id);
        $period->delete();
    }

    /** Opening renewal for one term closes it for every other. */
}
