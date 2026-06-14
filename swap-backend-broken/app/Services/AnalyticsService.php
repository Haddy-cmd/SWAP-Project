<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Assignment;
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

        $activeRecipients = Assignment::where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->where('status', 'active')
            ->count();

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
            ->selectRaw("DATE_TRUNC('month', created_at) as month, COUNT(*) as total_applications, SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved")
            ->groupByRaw("DATE_TRUNC('month', created_at)")
            ->orderByRaw("DATE_TRUNC('month', created_at)")
            ->get()
            ->map(fn ($row) => [
                'month' => $row->month,
                'total_applications' => (int) $row->total_applications,
                'approved' => (int) $row->approved,
            ])
            ->toArray();

        $stipendSummary = StipendHistory::where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->selectRaw("status, SUM(amount) as total")
            ->groupBy('status')
            ->pluck('total', 'status')
            ->toArray();

        return [
            'total_applicants' => array_sum($statusCounts),
            'approved' => (int) ($statusCounts['approved'] ?? 0),
            'rejected' => (int) ($statusCounts['rejected'] ?? 0),
            'pending' => (int) (
                ($statusCounts['submitted'] ?? 0) +
                ($statusCounts['under_review'] ?? 0) +
                ($statusCounts['interview_scheduled'] ?? 0)
            ),
            'active_recipients' => $activeRecipients,
            'total_verified_hours' => (float) $totalVerifiedHours,
            'pending_verifications' => $pendingVerifications,
            'office_distribution' => $officeDistribution,
            'monthly_stats' => $monthlyStats,
            'stipend_summary' => [
                'total_released' => (float) ($stipendSummary['released'] ?? 0),
                'total_pending' => (float) ($stipendSummary['pending'] ?? 0),
            ],
        ];
    }
}
