<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\MonthlyReport;
use App\Models\SemesterReport;
use App\Models\TimeLog;
use App\Models\User;
use App\Models\WeeklyReport;
use Illuminate\Support\Carbon;

class ReportService
{
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
