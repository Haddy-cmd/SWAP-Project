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
     * Build a downloadable admin report as tabular data (streamed to CSV by the
     * controller). All queries exclude soft-deleted users' records so the export
     * matches the dashboard. Returns ['filename', 'headers', 'rows'].
     */
    public function buildAdminExport(string $type, string $academicYear, string $semester): array
    {
        $slug = str_replace(' ', '', strtolower($semester));
        $stamp = now()->format('Ymd');

        return match ($type) {
            'applications' => [
                'filename' => "applications-summary-{$academicYear}-{$slug}-{$stamp}.csv",
                'headers' => ['Applicant', 'Email', 'Student ID', 'College', 'Program', 'Year Level', 'Status', 'Submitted'],
                'rows' => Application::whereHas('user')
                    ->where('academic_year', $academicYear)
                    ->where('semester', $semester)
                    ->with('user.profile')
                    ->orderBy('created_at')
                    ->get()
                    ->map(fn ($a) => [
                        $a->user?->name,
                        $a->user?->email,
                        $a->user?->profile?->student_id_number,
                        $a->user?->profile?->college,
                        $a->user?->profile?->program,
                        $a->user?->profile?->year_level,
                        ucwords(str_replace('_', ' ', $a->status)),
                        $a->created_at?->format('Y-m-d H:i'),
                    ])->all(),
            ],
            'recipients' => [
                'filename' => "recipients-hours-{$academicYear}-{$slug}-{$stamp}.csv",
                'headers' => ['Recipient', 'Email', 'Student ID', 'College', 'Office', 'Supervisor', 'Required Hours', 'Verified Hours', 'Remaining', 'Status'],
                'rows' => Assignment::whereHas('user')
                    ->where('academic_year', $academicYear)
                    ->where('semester', $semester)
                    ->with(['user.profile', 'office', 'supervisor'])
                    ->withSum(['timeLogs as verified_sum' => fn ($q) => $q->where('status', 'verified')], 'duration_hours')
                    ->orderBy('office_id')
                    ->get()
                    ->map(function ($a) {
                        $verified = round((float) ($a->verified_sum ?? 0), 2);
                        return [
                            $a->user?->name,
                            $a->user?->email,
                            $a->user?->profile?->student_id_number,
                            $a->user?->profile?->college,
                            $a->office?->name,
                            $a->supervisor?->name ?? 'Unassigned',
                            $a->required_hours,
                            $verified,
                            max(0, $a->required_hours - $verified),
                            ucwords($a->status),
                        ];
                    })->all(),
            ],
            'stipend' => [
                'filename' => "stipend-disbursement-{$academicYear}-{$slug}-{$stamp}.csv",
                'headers' => ['Recipient', 'Email', 'Student ID', 'Amount', 'Status', 'Period', 'Released At'],
                'rows' => StipendHistory::whereHas('recipient')
                    ->where('academic_year', $academicYear)
                    ->where('semester', $semester)
                    ->with('recipient.profile')
                    ->orderByDesc('created_at')
                    ->get()
                    ->map(fn ($s) => [
                        $s->recipient?->name,
                        $s->recipient?->email,
                        $s->recipient?->profile?->student_id_number,
                        number_format((float) $s->amount, 2, '.', ''),
                        ucwords($s->status),
                        $s->period_label,
                        $s->released_at?->format('Y-m-d H:i') ?? '—',
                    ])->all(),
            ],
            'offices' => [
                'filename' => "office-assignments-{$academicYear}-{$slug}-{$stamp}.csv",
                'headers' => ['Office', 'Code', 'Head', 'Location', 'Capacity', 'Active Recipients', 'Supervisors'],
                'rows' => Office::orderBy('name')->get()->map(fn ($o) => [
                    $o->name,
                    $o->code,
                    $o->head_name ?? '—',
                    $o->location ?? '—',
                    $o->max_recipients,
                    Assignment::whereHas('user')
                        ->where('office_id', $o->id)
                        ->where('academic_year', $academicYear)
                        ->where('semester', $semester)
                        ->where('status', 'active')
                        ->count(),
                    User::where('role', 'supervisor')->where('office_id', $o->id)->count(),
                ])->all(),
            ],
            default => [
                'filename' => "report-{$stamp}.csv",
                'headers' => ['Message'],
                'rows' => [['Unknown report type.']],
            ],
        };
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
