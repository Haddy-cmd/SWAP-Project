<?php

namespace App\Reports\Datasets;

use App\Models\Assignment;
use App\Reports\ReportDataset;
use App\Support\ReportLabels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * A supervisor's current students: the sheet they hand to the DSA. Scoped through
 * visibleToSupervisor(), so co-supervisors of an office see the same students.
 */
class RosterDataset extends ReportDataset
{
    public function title(): string
    {
        return 'Recipient Service Hours Summary';
    }

    public function slug(): string
    {
        return 'service-hours-summary';
    }

    public function needsTerm(): bool
    {
        return false;
    }

    public function defaultGroup(): ?string
    {
        return 'pace';
    }

    public function columns(): array
    {
        return [
            self::col('recipient', 'Recipient'),
            self::col('student_id', 'Student ID'),
            self::col('email', 'Email'),
            self::col('college', 'College', filterable: true),
            self::col('office', 'Office', filterable: true),
            self::col('term', 'Term', filterable: true),
            self::col('required_hours', 'Required Hours', 'hours', metric: true),
            self::col('verified_hours', 'Verified Hours', 'hours', metric: true),
            self::col('pending_hours', 'Pending Hours', 'hours', metric: true),
            self::col('remaining_hours', 'Remaining Hours', 'hours', metric: true),
            self::col('percent', '% Complete', 'percent'),
            self::col('pace', 'Pace', 'status', filterable: true),
            self::col('term_status', 'Term Status', 'status', filterable: true),
            self::col('report', 'End-of-Term Report', 'status', filterable: true),
            self::col('promissory', 'Promissory Note', 'status', filterable: true),
            self::col('last_clock_in', 'Last Clock-in', 'date'),
            self::col('days_on_duty', 'Days on Duty', 'number', metric: true),
            self::col('flagged_logs', 'Flagged Logs', 'number', metric: true),
        ];
    }

    /** Memoised: rows() and meta() read the same placements. */
    private ?Collection $assignments = null;

    private function assignments(): Collection
    {
        return $this->assignments ??= Assignment::whereHas('user')
            ->with(['user.profile', 'office', 'termReport'])
            ->withSum(['timeLogs as verified_sum' => fn ($q) => $q->where('status', 'verified')], 'duration_hours')
            ->withSum(['timeLogs as pending_sum' => fn ($q) => $q->where('status', 'pending_verification')], 'duration_hours')
            ->withMax('timeLogs as last_clock_in', 'time_in')
            ->withAggregate(['timeLogs as days_on_duty' => fn ($q) => $q->whereNotNull('time_out')->where('status', '!=', 'rejected')], DB::raw('DISTINCT time_logs.date'), 'count')
            ->withCount(['timeLogs as flagged_logs' => fn ($q) => $q->where('location_flagged', true)])
            ->withPromissoryFlags()
            ->visibleToSupervisor($this->scope->user)
            ->where('status', 'active')
            ->get()
            ->sortBy(fn ($a) => self::name($a->user) ?? '')
            ->values();
    }

    public function rows(): Collection
    {
        return $this->assignments()->map(function (Assignment $a) {
            $pace = $a->paceStatus();

            return [
                'recipient' => self::name($a->user),
                'student_id' => $a->user?->profile?->student_id_number,
                'email' => $a->user?->email,
                'college' => $a->user?->profile?->college,
                'office' => $a->office?->name,
                'term' => "{$a->semester} {$a->academic_year}",
                'required_hours' => (float) $a->required_hours,
                'verified_hours' => round($a->verified_hours, 2),
                'pending_hours' => round($a->pending_hours, 2),
                'remaining_hours' => round($a->remaining_hours, 2),
                'percent' => $pace['percent'],
                'pace' => self::label($pace['status']),
                'term_status' => self::label($a->term_status) ?? 'In Progress',
                'report' => ReportLabels::termReport($a->termReport),
                'promissory' => ReportLabels::promissory($a),
                'last_clock_in' => $a->last_clock_in ? Carbon::parse($a->last_clock_in)->timezone('Asia/Manila')->format('Y-m-d') : null,
                'days_on_duty' => (int) $a->days_on_duty,
                'flagged_logs' => (int) $a->flagged_logs,
            ];
        });
    }

    public function stats(Collection $rows): array
    {
        $verified = round($rows->sum('verified_hours'), 2);
        $required = (float) $rows->sum('required_hours');

        return [
            ['label' => 'Recipients', 'value' => (string) $rows->count()],
            ['label' => 'Verified Hours', 'value' => (string) $verified],
            ['label' => 'Avg Completion', 'value' => ($required > 0 ? round($verified / $required * 100, 1) : 0) . '%'],
            ['label' => 'Behind Pace', 'value' => (string) $rows->where('pace', 'Behind')->count()],
            ['label' => 'Reports to Accept', 'value' => (string) $rows->where('report', 'Submitted')->count()],
        ];
    }

    /**
     * The header names the supervisor's own office. A supervisor can also be named
     * directly on an assignment in another office, so the roster may span several —
     * the per-row Office column, not this heading, is the authority.
     */
    public function meta(): array
    {
        $supervisor = $this->scope->user;
        $officeNames = $this->assignments()->pluck('office.name')->filter()->unique();
        $office = $supervisor->office?->name
            ?? ($officeNames->count() === 1 ? $officeNames->first() : null)
            ?? ($officeNames->isNotEmpty() ? $officeNames->count() . ' offices' : '—');

        return ['Office' => $office, 'Supervisor' => self::name($supervisor)];
    }
}
