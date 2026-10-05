<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Assignment;
use App\Models\Office;
use App\Models\StipendHistory;
use App\Models\TermReport;
use App\Models\TimeLog;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use App\Models\User;

class ReportService
{
    /**
     * Admin report as structured data: ['title','slug','headers','rows','stats'].
     * Backs both the live preview (JSON) and the CSV export. All queries exclude
     * soft-deleted users so the numbers match the dashboard.
     */
    public function adminReportData(string $type, string $academicYear, string $semester): array
    {
        return match ($type) {
            'applications' => $this->applicationsReport($academicYear, $semester),
            'recipients' => $this->recipientsReport($academicYear, $semester),
            'stipend' => $this->stipendReport($academicYear, $semester),
            'offices' => $this->officesReport($academicYear, $semester),
            'term-results' => $this->termResultsReport($academicYear, $semester),
            default => ['title' => 'Report', 'slug' => 'report', 'headers' => ['Message'], 'rows' => [['Unknown report type.']], 'stats' => []],
        };
    }

    /** The same data with a timestamped .csv filename for the streamed download. */
    public function buildAdminExport(string $type, string $academicYear, string $semester): array
    {
        $data = $this->adminReportData($type, $academicYear, $semester);
        $sem = str_replace(' ', '', strtolower($semester));
        $data['filename'] = "{$data['slug']}-{$academicYear}-{$sem}-" . now()->format('Ymd') . '.csv';

        return $data;
    }

    /**
     * End-of-semester summary of one supervisor's roster — the sheet they hand to
     * the DSA. Scoped through visibleToSupervisor(), so co-supervisors of an office
     * export the same students they can already see.
     */
    public function supervisorRosterData(User $supervisor): array
    {
        $asgs = Assignment::whereHas('user')
            ->with(['user.profile', 'office', 'termReport'])
            ->withSum(['timeLogs as verified_sum' => fn ($q) => $q->where('status', 'verified')], 'duration_hours')
            ->withSum(['timeLogs as pending_sum' => fn ($q) => $q->where('status', 'pending_verification')], 'duration_hours')
            ->withMax('timeLogs as last_clock_in', 'time_in')
            ->withAggregate(['timeLogs as days_on_duty' => fn ($q) => $q->whereNotNull('time_out')->where('status', '!=', 'rejected')], DB::raw('DISTINCT time_logs.date'), 'count')
            ->withCount(['timeLogs as flagged_logs' => fn ($q) => $q->where('location_flagged', true)])
            ->withPromissoryFlags()
            ->visibleToSupervisor($supervisor)
            ->where('status', 'active')
            ->get()
            ->sortBy(fn ($a) => $a->user?->profile?->full_name ?? $a->user?->name ?? '')
            ->values();

        $verified = round($asgs->sum(fn ($a) => $a->verified_hours), 2);
        $pending = round($asgs->sum(fn ($a) => $a->pending_hours), 2);
        $required = (float) $asgs->sum('required_hours');
        $behind = $asgs->filter(fn ($a) => $a->paceStatus()['status'] === 'behind')->count();
        $toAccept = $asgs->filter(fn ($a) => $a->termReport?->submitted_at && !$a->termReport->reviewed_at)->count();

        // The header names the supervisor's own office. A supervisor can also be named
        // directly on an assignment in another office, so the roster may span several —
        // the per-row Office column, not this heading, is the authority on where a
        // student actually serves.
        $officeNames = $asgs->pluck('office.name')->filter()->unique();
        $office = $supervisor->office?->name
            ?? ($officeNames->count() === 1 ? $officeNames->first() : null)
            ?? ($officeNames->isNotEmpty() ? $officeNames->count() . ' offices' : '—');

        return [
            'title' => 'Recipient Service Hours Summary',
            'slug' => 'service-hours-summary',
            'office' => $office,
            'supervisor' => $supervisor->profile?->full_name ?? $supervisor->name,
            'headers' => [
                'Recipient', 'Student ID', 'Email', 'Office', 'Academic Year', 'Semester',
                'Required Hours', 'Verified Hours', 'Pending Hours', 'Remaining Hours', '% Complete', 'Pace',
                'Term Status', 'End-of-Term Report', 'Promissory Note', 'Last Clock-in', 'Days on Duty', 'Flagged Logs',
            ],
            'stats' => [
                ['label' => 'Recipients', 'value' => (string) $asgs->count()],
                ['label' => 'Verified Hours', 'value' => (string) $verified],
                ['label' => 'Avg Completion', 'value' => ($required > 0 ? round($verified / $required * 100, 1) : 0) . '%'],
                ['label' => 'Behind Pace', 'value' => (string) $behind],
                ['label' => 'Reports to Accept', 'value' => (string) $toAccept],
            ],
            'totals' => [
                'recipients' => $asgs->count(),
                'required' => $required,
                'verified' => $verified,
                'pending' => $pending,
                'behind' => $behind,
            ],
            'rows' => $asgs->map(function ($a) {
                $pace = $a->paceStatus();

                return [
                    $a->user?->profile?->full_name ?? $a->user?->name,
                    $a->user?->profile?->student_id_number,
                    $a->user?->email,
                    $a->office?->name,
                    $a->academic_year,
                    $a->semester,
                    $a->required_hours,
                    round($a->verified_hours, 2),
                    round($a->pending_hours, 2),
                    $a->remaining_hours,
                    $pace['percent'] . '%',
                    ucwords(str_replace('_', ' ', $pace['status'])),
                    $a->term_status ? ucfirst($a->term_status) : 'In Progress',
                    self::reportLabel($a->termReport),
                    self::promissoryLabel($a),
                    $a->last_clock_in ? Carbon::parse($a->last_clock_in)->timezone('Asia/Manila')->format('M j, Y') : 'Never',
                    (int) $a->days_on_duty,
                    (int) $a->flagged_logs,
                ];
            })->all(),
        ];
    }

    /** A student with no clock-in for this many days (or never) is listed as inactive. */
    public const INACTIVE_AFTER_DAYS = 7;

    /**
     * Supervisor → Reports → Insights, over the students they can see: what waits for
     * verification, how quickly they verify, who has stopped coming, and automatic clock-outs.
     */
    public function supervisorInsights(User $supervisor): array
    {
        $asgs = Assignment::whereHas('user')
            ->with('user.profile')
            ->withMax('timeLogs as last_clock_in', 'time_in')
            ->withCount(['timeLogs as auto_clock_outs' => fn ($q) => $q->whereIn('clocked_out_reason', ['auto', 'auto_stale'])])
            ->visibleToSupervisor($supervisor)
            ->where('status', 'active')
            ->get();
        $ids = $asgs->pluck('id');
        $name = fn (Assignment $a) => $a->user?->profile?->full_name ?? $a->user?->name;

        $pending = TimeLog::whereIn('assignment_id', $ids)->where('status', 'pending_verification')
            ->selectRaw('COUNT(*) as n, COALESCE(SUM(duration_hours), 0) as hours, MIN(time_out) as oldest')->first();
        $sessions = TimeLog::whereIn('assignment_id', $ids)->whereNotNull('time_out')->where('is_manual', false)
            ->where('status', '!=', 'rejected')->avg('duration_hours');
        $turnaround = TimeLog::where('verified_by', $supervisor->id)->where('status', 'verified')->where('is_manual', false)
            ->where('verified_at', '>=', now()->subDays(30))->whereNotNull('time_out')
            ->selectRaw('COUNT(*) as n, AVG(EXTRACT(EPOCH FROM (verified_at - time_out))) / 3600 as hours')->first();

        $cutoff = now()->subDays(self::INACTIVE_AFTER_DAYS);
        $inactive = $asgs->filter(fn (Assignment $a) => !$a->last_clock_in || Carbon::parse($a->last_clock_in)->lt($cutoff))
            ->sortBy(fn (Assignment $a) => $a->last_clock_in ?? '')
            ->map(fn (Assignment $a) => [
                'student_id' => $a->user_id,
                'name' => $name($a),
                'last_clock_in' => $a->last_clock_in ? Carbon::parse($a->last_clock_in)->toISOString() : null,
                'days' => $a->last_clock_in ? (int) Carbon::parse($a->last_clock_in)->diffInDays(now()) : null,
            ])->values()->all();

        return [
            'students' => $asgs->count(),
            'pending' => (int) $pending->n,
            'pending_hours' => round((float) $pending->hours, 2),
            'oldest_pending_days' => $pending->oldest ? (int) Carbon::parse($pending->oldest)->diffInDays(now()) : null,
            'my_verified_30d' => (int) $turnaround->n,
            'my_avg_verify_hours' => $turnaround->n ? round((float) $turnaround->hours, 1) : null,
            'avg_session_hours' => $sessions !== null ? round((float) $sessions, 2) : null,
            'inactive_after_days' => self::INACTIVE_AFTER_DAYS,
            'inactive' => $inactive,
            'auto_clock_outs' => $asgs->filter(fn (Assignment $a) => $a->auto_clock_outs > 0)
                ->sortByDesc('auto_clock_outs')->take(10)
                ->map(fn (Assignment $a) => ['student_id' => $a->user_id, 'name' => $name($a), 'count' => (int) $a->auto_clock_outs])
                ->values()->all(),
        ];
    }

    /** The roster summary with a timestamped .csv filename for the streamed download. */
    public function buildSupervisorExport(User $supervisor): array
    {
        $data = $this->supervisorRosterData($supervisor);
        $data['filename'] = "{$data['slug']}-" . now()->format('Ymd') . '.csv';

        return $data;
    }

    private function applicationsReport(string $ay, string $sem): array
    {
        $apps = Application::whereHas('user')
            ->where('academic_year', $ay)->where('semester', $sem)
            ->with('user.profile')->orderBy('created_at')->get();

        $count = fn ($statuses) => $apps->whereIn('status', (array) $statuses)->count();

        return [
            'title' => 'Applications Summary',
            'slug' => 'applications-summary',
            'headers' => ['Applicant', 'Email', 'Student ID', 'College', 'Program', 'Year Level', 'Status', 'Submitted'],
            'stats' => [
                ['label' => 'Total', 'value' => (string) $apps->count()],
                ['label' => 'Approved', 'value' => (string) $count('approved')],
                ['label' => 'Pending', 'value' => (string) $count(['submitted', 'under_review', 'interview_scheduled'])],
                ['label' => 'Rejected', 'value' => (string) $count('rejected')],
            ],
            'rows' => $apps->map(fn ($a) => [
                $a->user?->name,
                $a->user?->email,
                $a->user?->profile?->student_id_number,
                $a->user?->profile?->college,
                $a->user?->profile?->program,
                $a->user?->profile?->year_level,
                ucwords(str_replace('_', ' ', $a->status)),
                $a->created_at?->format('Y-m-d H:i'),
            ])->all(),
        ];
    }

    /** End-of-term report state, as the roster and the term results print it. */
    public static function reportLabel(?TermReport $report): string
    {
        return match (true) {
            !$report || !$report->submitted_at => 'Missing',
            !$report->reviewed_at => 'Submitted',
            default => $report->renewal_eligible ? 'Accepted · Eligible' : 'Accepted · Not eligible',
        };
    }

    /** Approved / Pending from `withPromissoryFlags()`, else blank. */
    private static function promissoryLabel(Assignment $a): string
    {
        return match (true) {
            (bool) $a->has_approved_promissory => 'Approved',
            (bool) $a->has_pending_promissory => 'Pending',
            default => '',
        };
    }

    /**
     * How each placement of the term ended: hours, verdict, promissory note, end-of-term
     * report, stipend and renewal. Renewal = the student's first renewal application
     * made after this placement, for another term.
     */
    private function termResultsReport(string $ay, string $sem): array
    {
        $asgs = Assignment::whereHas('user')
            ->where('academic_year', $ay)->where('semester', $sem)
            ->whereIn('status', ['active', 'completed'])
            ->with(['user.profile', 'office', 'termReport'])
            ->withSum(['timeLogs as verified_sum' => fn ($q) => $q->where('status', 'verified')], 'duration_hours')
            ->withPromissoryFlags()
            ->get()
            ->sortBy(fn ($a) => $a->user?->profile?->full_name ?? $a->user?->name ?? '')
            ->values();

        $userIds = $asgs->pluck('user_id');
        $stubs = StipendHistory::whereIn('user_id', $userIds)
            ->where('academic_year', $ay)->where('semester', $sem)
            ->where('status', '!=', StipendHistory::STATUS_VOID)
            ->orderByDesc('id')->get(['user_id', 'status'])
            ->unique('user_id')->keyBy('user_id');
        $renewals = Application::whereIn('user_id', $userIds)
            ->where('type', 'renewal')
            ->where(fn ($q) => $q->where('academic_year', '!=', $ay)->orWhere('semester', '!=', $sem))
            ->orderBy('created_at')->get(['user_id', 'status', 'created_at'])
            ->groupBy('user_id');

        $rows = $asgs->map(function (Assignment $a) use ($stubs, $renewals) {
            $renewal = ($renewals->get($a->user_id) ?? collect())->first(fn ($r) => $r->created_at >= $a->created_at);
            $stub = $stubs->get($a->user_id);

            return [
                'verdict' => $a->term_status,
                'promissory' => self::promissoryLabel($a),
                'renewal' => $renewal?->status,
                'row' => [
                    $a->user?->profile?->full_name ?? $a->user?->name,
                    $a->user?->profile?->student_id_number,
                    $a->office?->name,
                    $a->required_hours,
                    round((float) ($a->verified_sum ?? 0), 2),
                    $a->term_status ? ucfirst($a->term_status) : 'In Progress',
                    $a->deficient_hours !== null ? (float) $a->deficient_hours : '',
                    self::promissoryLabel($a),
                    self::reportLabel($a->termReport),
                    match ($stub?->status) {
                        'claimed', 'released' => 'Claimed',
                        'certified', 'pending' => 'Ready to claim',
                        default => '—',
                    },
                    match ($renewal?->status) {
                        null => '—',
                        'approved' => 'Approved',
                        'rejected' => 'Rejected',
                        default => 'Waiting',
                    },
                ],
            ];
        });

        return [
            'title' => 'Term Results',
            'slug' => 'term-results',
            'headers' => ['Recipient', 'Student ID', 'Office', 'Required Hours', 'Verified Hours', 'Verdict', 'Deficient Hours',
                'Promissory Note', 'End-of-Term Report', 'Stipend', 'Renewal'],
            'stats' => [
                ['label' => 'Qualified', 'value' => (string) $rows->where('verdict', Assignment::TERM_QUALIFIED)->count()],
                ['label' => 'Deficient', 'value' => (string) $rows->where('verdict', Assignment::TERM_DEFICIENT)->count()],
                ['label' => 'Notes Approved', 'value' => (string) $rows->where('promissory', 'Approved')->count()],
                ['label' => 'Renewed', 'value' => (string) $rows->where('renewal', 'approved')->count()],
            ],
            'rows' => $rows->pluck('row')->all(),
        ];
    }

    private function recipientsReport(string $ay, string $sem): array
    {
        $asgs = Assignment::whereHas('user')
            ->where('academic_year', $ay)->where('semester', $sem)
            ->with(['user.profile', 'office', 'supervisor'])
            ->withSum(['timeLogs as verified_sum' => fn ($q) => $q->where('status', 'verified')], 'duration_hours')
            ->orderBy('office_id')->get();

        $verified = round($asgs->sum(fn ($a) => (float) ($a->verified_sum ?? 0)), 2);
        $required = (float) $asgs->sum('required_hours');
        $avg = $required > 0 ? round($verified / $required * 100, 1) : 0;

        return [
            'title' => 'Recipients & Hours',
            'slug' => 'recipients-hours',
            'headers' => ['Recipient', 'Email', 'Student ID', 'College', 'Office', 'Supervisor', 'Required Hours', 'Verified Hours', 'Remaining', 'Status', 'Term Status', 'Deficient Hours'],
            'stats' => [
                ['label' => 'Recipients', 'value' => (string) $asgs->count()],
                ['label' => 'Avg Completion', 'value' => $avg . '%'],
                ['label' => 'Verified Hours', 'value' => (string) $verified],
                ['label' => 'Offices', 'value' => (string) $asgs->pluck('office_id')->filter()->unique()->count()],
            ],
            'rows' => $asgs->map(function ($a) {
                $v = round((float) ($a->verified_sum ?? 0), 2);
                return [
                    $a->user?->name,
                    $a->user?->email,
                    $a->user?->profile?->student_id_number,
                    $a->user?->profile?->college,
                    $a->office?->name,
                    $a->supervisor?->name ?? 'Unassigned',
                    $a->required_hours,
                    $v,
                    max(0, $a->required_hours - $v),
                    ucwords($a->status),
                    $a->term_status ? ucfirst($a->term_status) : 'In Progress',
                    $a->deficient_hours !== null ? (float) $a->deficient_hours : '',
                ];
            })->all(),
        ];
    }

    private function stipendReport(string $ay, string $sem): array
    {
        $stipends = StipendHistory::whereHas('recipient')
            ->where('academic_year', $ay)->where('semester', $sem)
            ->with('recipient.profile')->orderByDesc('created_at')->get();

        // Option C lifecycle: a stub is paid once claimed (legacy rows say
        // 'released'); certified stubs (and legacy 'pending') await claim.
        $paid = $stipends->whereIn('status', ['claimed', 'released']);
        $awaiting = $stipends->whereIn('status', ['certified', 'pending']);

        return [
            'title' => 'Stipend Disbursement',
            'slug' => 'stipend-disbursement',
            'headers' => ['Recipient', 'Email', 'Student ID', 'Amount', 'Status', 'Period', 'Claimed At', 'Via Promissory', 'Deficient Hours'],
            'stats' => [
                ['label' => 'Total Claimed', 'value' => '₱' . number_format((float) $paid->sum('amount'), 0)],
                ['label' => 'Recipients', 'value' => (string) $stipends->where('status', '!=', 'void')->count()],
                ['label' => 'Awaiting Claim', 'value' => '₱' . number_format((float) $awaiting->sum('amount'), 0)],
                ['label' => 'Claimed', 'value' => (string) $paid->count()],
            ],
            'rows' => $stipends->map(fn ($s) => [
                $s->recipient?->name,
                $s->recipient?->email,
                $s->recipient?->profile?->student_id_number,
                number_format((float) $s->amount, 2, '.', ''),
                ucwords($s->status),
                $s->period_label,
                ($s->claimed_at ?? $s->released_at)?->format('Y-m-d H:i') ?? '—',
                $s->via_promissory ? 'Yes' : 'No',
                $s->deficient_hours !== null ? (float) $s->deficient_hours : '',
            ])->all(),
        ];
    }

    private function officesReport(string $ay, string $sem): array
    {
        $offices = Office::orderBy('name')->get();

        $detail = $offices->map(function ($o) use ($ay, $sem) {
            $active = Assignment::whereHas('user')
                ->where('office_id', $o->id)->where('academic_year', $ay)->where('semester', $sem)
                ->where('status', 'active')->count();
            $sup = User::where('role', 'supervisor')->where('office_id', $o->id)->count();
            return ['name' => $o->name, 'head' => $o->head_name ?? '—', 'location' => $o->location ?? '—', 'cap' => $o->max_recipients, 'active' => $active, 'sup' => $sup];
        });

        return [
            'title' => 'Office Assignment',
            'slug' => 'office-assignments',
            'headers' => ['Office', 'Code', 'Head', 'Location', 'Capacity', 'Active Recipients', 'Supervisors'],
            'stats' => [
                ['label' => 'Offices', 'value' => (string) $offices->count()],
                ['label' => 'Assigned', 'value' => (string) $detail->sum('active')],
                ['label' => 'Full Offices', 'value' => (string) $detail->filter(fn ($r) => $r['cap'] > 0 && $r['active'] >= $r['cap'])->count()],
                ['label' => 'Supervisors', 'value' => (string) $detail->sum('sup')],
            ],
            'rows' => $detail->map(fn ($r) => [$r['name'], $r['head'], $r['location'], $r['cap'], $r['active'], $r['sup']])->all(),
        ];
    }
}
