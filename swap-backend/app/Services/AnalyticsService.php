<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Assignment;
use App\Models\Office;
use App\Models\StipendHistory;
use App\Models\TimeLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AnalyticsService
{
    /**
     * Distinct academic-year / semester periods that actually have data
     * (from applications or assignments), most recent first.
     */
    public function getAvailablePeriods(): array
    {
        $fromApplications = Application::select('academic_year', 'semester')->distinct();

        $periods = Assignment::select('academic_year', 'semester')
            ->distinct()
            ->union($fromApplications)
            ->get()
            ->map(fn ($row) => [
                'academic_year' => $row->academic_year,
                'semester' => $row->semester,
            ])
            ->unique(fn ($p) => $p['academic_year'].'|'.$p['semester'])
            // Year desc, then 2nd Semester before 1st within the same year.
            ->sortByDesc(fn ($p) => $p['academic_year'].'|'.$p['semester'])
            ->values()
            ->toArray();

        return $periods;
    }

    public function getAdminOverview(string $academicYear, string $semester): array
    {
        $statusCounts = Application::where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $totalVerifiedHours = TimeLog::whereHas('assignment', fn ($q) =>
            $q->where('academic_year', $academicYear)->where('semester', $semester)
        )->where('status', 'verified')
            ->sum('duration_hours');

        $pendingVerifications = TimeLog::whereHas('assignment', fn ($q) =>
            $q->where('academic_year', $academicYear)->where('semester', $semester)
        )->where('status', 'pending_verification')
            ->count();

        $officeDistribution = Assignment::with('office')
            ->where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->where('status', 'active')
            ->selectRaw('office_id, COUNT(*) as recipient_count')
            ->groupBy('office_id')
            ->get()
            ->map(fn ($row) => [
                'office_name' => $row->office?->name ?? 'Unknown',
                'recipient_count' => (int) $row->recipient_count,
            ])
            ->values()
            ->toArray();

        $monthlyStats = Application::where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->selectRaw("TO_CHAR(created_at, 'Mon YYYY') as month, COUNT(*) as total_applications, SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved, SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected")
            ->groupByRaw("TO_CHAR(created_at, 'Mon YYYY')")
            ->orderByRaw("MIN(created_at)")
            ->get()
            ->map(fn ($row) => [
                'month' => $row->month,
                'total_applications' => (int) $row->total_applications,
                'approved' => (int) $row->approved,
                'rejected' => (int) $row->rejected,
            ])
            ->toArray();

        // Applicants grouped by their college (from the student profile), period-scoped.
        $applicantsByCollege = Application::where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->join('student_profiles', 'student_profiles.user_id', '=', 'applications.user_id')
            ->selectRaw('student_profiles.college as college, COUNT(*) as applicant_count')
            ->groupBy('student_profiles.college')
            ->orderByDesc('applicant_count')
            ->get()
            ->map(fn ($row) => [
                'college' => $row->college,
                'applicant_count' => (int) $row->applicant_count,
            ])
            ->toArray();

        // Active recipients grouped by their college (from the student profile), period-scoped.
        $recipientsByCollege = Assignment::where('assignments.academic_year', $academicYear)
            ->where('assignments.semester', $semester)
            ->where('assignments.status', 'active')
            ->join('student_profiles', 'student_profiles.user_id', '=', 'assignments.user_id')
            ->selectRaw('student_profiles.college as college, COUNT(*) as recipient_count')
            ->groupBy('student_profiles.college')
            ->orderByDesc('recipient_count')
            ->get()
            ->map(fn ($row) => [
                'college' => $row->college,
                'recipient_count' => (int) $row->recipient_count,
            ])
            ->toArray();

        // Weekly verified vs. pending hours for the trend chart (previously had no data source).
        $weeklyHours = TimeLog::whereHas('assignment', fn ($q) =>
            $q->where('academic_year', $academicYear)->where('semester', $semester)
        )
            ->whereNotNull('time_out')
            ->whereIn('status', ['verified', 'pending_verification'])
            ->selectRaw("TO_CHAR(DATE_TRUNC('week', date), 'Mon DD') as week, SUM(CASE WHEN status = 'verified' THEN duration_hours ELSE 0 END) as verified, SUM(CASE WHEN status = 'pending_verification' THEN duration_hours ELSE 0 END) as pending")
            ->groupByRaw("TO_CHAR(DATE_TRUNC('week', date), 'Mon DD')")
            ->orderByRaw("MIN(date)")
            ->get()
            ->map(fn ($row) => [
                'week' => $row->week,
                'verified' => (float) $row->verified,
                'pending' => (float) $row->pending,
            ])
            ->toArray();

        $stipendSummary = StipendHistory::where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->selectRaw("status, SUM(amount) as total")
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        // System-wide totals for the dashboard headline cards (not period-scoped),
        // so they always reflect the current state across all academic years.
        $totalApplicationsAll = Application::count();
        $activeRecipientsAll = Assignment::where('status', 'active')->count();
        $pendingApplicationsAll = Application::whereIn('status', [
            'submitted', 'under_review', 'interview_scheduled',
        ])->count();
        $totalOffices = Office::where('is_active', true)->count();

        $officeDistributionAll = Assignment::with('office')
            ->where('status', 'active')
            ->selectRaw('office_id, COUNT(*) as recipient_count')
            ->groupBy('office_id')
            ->get()
            ->map(fn ($row) => [
                'office_name' => $row->office?->name ?? 'Unknown',
                'recipient_count' => (int) $row->recipient_count,
            ])
            ->values()
            ->toArray();

        $requiredHoursAll = (float) Assignment::where('status', 'active')->sum('required_hours');
        $verifiedHoursAll = (float) TimeLog::where('status', 'verified')->sum('duration_hours');
        $avgCompletionRate = $requiredHoursAll > 0
            ? round(min(($verifiedHoursAll / $requiredHoursAll) * 100, 100), 1)
            : 0.0;

        return [
            'total_applicants' => array_sum($statusCounts),
            'total_applications' => $totalApplicationsAll,
            'approved' => (int) ($statusCounts['approved'] ?? 0),
            'rejected' => (int) ($statusCounts['rejected'] ?? 0),
            'pending' => (int) (
                ($statusCounts['submitted'] ?? 0) +
                ($statusCounts['under_review'] ?? 0) +
                ($statusCounts['interview_scheduled'] ?? 0)
            ),
            'pending_applications' => $pendingApplicationsAll,
            'active_recipients' => $activeRecipientsAll,
            'total_offices' => $totalOffices,
            'avg_completion_rate' => $avgCompletionRate,
            'total_verified_hours' => (float) $totalVerifiedHours,
            'pending_verifications' => $pendingVerifications,
            'office_distribution' => $officeDistribution,
            'office_distribution_all' => $officeDistributionAll,
            'monthly_stats' => $monthlyStats,
            'applicants_by_college' => $applicantsByCollege,
            'recipients_by_college' => $recipientsByCollege,
            'weekly_hours' => $weeklyHours,
            'stipend_summary' => [
                'total_released' => (float) ($stipendSummary['released'] ?? 0),
                'total_pending' => (float) ($stipendSummary['pending'] ?? 0),
            ],
        ];
    }
}
