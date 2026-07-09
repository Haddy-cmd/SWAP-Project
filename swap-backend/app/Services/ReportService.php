<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Assignment;
use App\Models\MonthlyReport;
use App\Models\Office;
use App\Models\SemesterReport;
use App\Models\StipendHistory;
use App\Models\TimeLog;
use App\Models\User;
use App\Models\WeeklyReport;
use Illuminate\Support\Carbon;

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
            ->with(['user.profile', 'office'])
            ->withSum(['timeLogs as verified_sum' => fn ($q) => $q->where('status', 'verified')], 'duration_hours')
            ->withSum(['timeLogs as pending_sum' => fn ($q) => $q->where('status', 'pending_verification')], 'duration_hours')
            ->visibleToSupervisor($supervisor)
            ->where('status', 'active')
            ->get()
            ->sortBy(fn ($a) => $a->user?->profile?->full_name ?? $a->user?->name ?? '')
            ->values();

        $verified = round($asgs->sum(fn ($a) => $a->verified_hours), 2);
        $pending = round($asgs->sum(fn ($a) => $a->pending_hours), 2);
        $required = (float) $asgs->sum('required_hours');
        $behind = $asgs->filter(fn ($a) => $a->paceStatus()['status'] === 'behind')->count();

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
            ],
            'stats' => [
                ['label' => 'Recipients', 'value' => (string) $asgs->count()],
                ['label' => 'Verified Hours', 'value' => (string) $verified],
                ['label' => 'Avg Completion', 'value' => ($required > 0 ? round($verified / $required * 100, 1) : 0) . '%'],
                ['label' => 'Behind Pace', 'value' => (string) $behind],
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
                ];
            })->all(),
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
            'headers' => ['Recipient', 'Email', 'Student ID', 'College', 'Office', 'Supervisor', 'Required Hours', 'Verified Hours', 'Remaining', 'Status'],
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
                ];
            })->all(),
        ];
    }

    private function stipendReport(string $ay, string $sem): array
    {
        $stipends = StipendHistory::whereHas('recipient')
            ->where('academic_year', $ay)->where('semester', $sem)
            ->with('recipient.profile')->orderByDesc('created_at')->get();

        $released = $stipends->where('status', 'released');
        $pending = $stipends->where('status', 'pending');

        return [
            'title' => 'Stipend Disbursement',
            'slug' => 'stipend-disbursement',
            'headers' => ['Recipient', 'Email', 'Student ID', 'Amount', 'Status', 'Period', 'Released At'],
            'stats' => [
                ['label' => 'Total Released', 'value' => '₱' . number_format((float) $released->sum('amount'), 0)],
                ['label' => 'Recipients', 'value' => (string) $stipends->count()],
                ['label' => 'Pending', 'value' => '₱' . number_format((float) $pending->sum('amount'), 0)],
                ['label' => 'Released', 'value' => (string) $released->count()],
            ],
            'rows' => $stipends->map(fn ($s) => [
                $s->recipient?->name,
                $s->recipient?->email,
                $s->recipient?->profile?->student_id_number,
                number_format((float) $s->amount, 2, '.', ''),
                ucwords($s->status),
                $s->period_label,
                $s->released_at?->format('Y-m-d H:i') ?? '—',
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
            return ['name' => $o->name, 'code' => $o->code, 'head' => $o->head_name ?? '—', 'location' => $o->location ?? '—', 'cap' => $o->max_recipients, 'active' => $active, 'sup' => $sup];
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
            'rows' => $detail->map(fn ($r) => [$r['name'], $r['code'], $r['head'], $r['location'], $r['cap'], $r['active'], $r['sup']])->all(),
        ];
    }

    public function getWeeklyReports(User $user): array
    {
        return WeeklyReport::where('user_id', $user->id)
            ->orderByDesc('week_start')
            ->get()
            ->toArray();
    }

    public function getMonthlyReports(User $user): array
    {
        return MonthlyReport::where('user_id', $user->id)
            ->orderByDesc('year')
            ->orderByDesc('month')
            ->get()
            ->toArray();
    }

    public function getSemesterReport(User $user): ?SemesterReport
    {
        return SemesterReport::where('user_id', $user->id)
            ->latest()
            ->first();
    }

    public function generateWeeklyReport(User $user, string $academicYear, string $semester, int $weekNumber): WeeklyReport
    {
        $assignment = Assignment::where('user_id', $user->id)
            ->where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->where('status', 'active')
            ->firstOrFail();

        $weekStart = Carbon::now()->startOfYear()->addWeeks($weekNumber - 1)->startOfWeek();
        $weekEnd = $weekStart->copy()->endOfWeek();

        $logs = TimeLog::where('user_id', $user->id)
            ->where('assignment_id', $assignment->id)
            ->whereBetween('date', [$weekStart->toDateString(), $weekEnd->toDateString()])
            ->whereNotNull('duration_hours')
            ->get();

        $totalHours = $logs->whereIn('status', ['pending_verification', 'verified', 'rejected'])->sum('duration_hours');
        $verifiedHours = $logs->where('status', 'verified')->sum('duration_hours');
        $daysPresent = $logs->whereNotNull('time_out')->pluck('date')->unique()->count();

        return WeeklyReport::updateOrCreate(
            [
                'user_id' => $user->id,
                'academic_year' => $academicYear,
                'semester' => $semester,
                'week_number' => $weekNumber,
            ],
            [
                'assignment_id' => $assignment->id,
                'week_start' => $weekStart->toDateString(),
                'week_end' => $weekEnd->toDateString(),
                'total_hours' => $totalHours,
                'verified_hours' => $verifiedHours,
                'days_present' => $daysPresent,
                'log_ids' => $logs->pluck('id')->toArray(),
            ]
        );
    }

    public function generateMonthlyReport(User $user, string $academicYear, string $semester, int $month, int $year): MonthlyReport
    {
        $assignment = Assignment::where('user_id', $user->id)
            ->where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->where('status', 'active')
            ->firstOrFail();

        $start = Carbon::createFromDate($year, $month, 1)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $logs = TimeLog::where('user_id', $user->id)
            ->where('assignment_id', $assignment->id)
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->whereNotNull('duration_hours')
            ->get();

        $totalHours = $logs->whereIn('status', ['pending_verification', 'verified', 'rejected'])->sum('duration_hours');
        $verifiedHours = $logs->where('status', 'verified')->sum('duration_hours');
        $daysPresent = $logs->whereNotNull('time_out')->pluck('date')->unique()->count();

        return MonthlyReport::updateOrCreate(
            [
                'user_id' => $user->id,
                'assignment_id' => $assignment->id,
                'month' => $month,
                'year' => $year,
            ],
            [
                'academic_year' => $academicYear,
                'semester' => $semester,
                'total_hours' => $totalHours,
                'verified_hours' => $verifiedHours,
                'days_present' => $daysPresent,
            ]
        );
    }
}
