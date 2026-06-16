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
            ->selectRaw("DATE_TRUNC('month', created_at) as month, COUNT(*) as total_applications, SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved, SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected")
            ->groupByRaw("DATE_TRUNC('month', created_at)")
            ->orderByRaw("DATE_TRUNC('month', created_at)")
            ->get()
            ->map(fn ($row) => [
                'month' => $row->month,
                'total_applications' => (int) $row->total_applications,
                'approved' => (int) $row->approved,
                'rejected' => (int) $row->rejected,
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
            'stipend_summary' => [
                'total_released' => (float) ($stipendSummary['released'] ?? 0),
                'total_pending' => (float) ($stipendSummary['pending'] ?? 0),
            ],
        ];
    }
}
