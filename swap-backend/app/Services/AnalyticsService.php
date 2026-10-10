<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Assignment;
use App\Models\Concern;
use App\Models\Interview;
use App\Models\Office;
use App\Models\SemesterPeriod;
use App\Models\StipendHistory;
use App\Models\TimeLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AnalyticsService
{
    /**
     * The terms the admin can pick: every term with applications or assignments plus
     * every semester period on the DSA calendar. The **current** semester period comes
     * first — pages open on periods[0] — then the rest, newest first by start date
     * (a term not on the calendar is dated by its usual month: 1st Semester August,
     * 2nd Semester January, Summer June). Sorting by name put "2nd Semester" before
     * "1st Semester" of the same year even when the 1st was the one running.
     */
    public function getAvailablePeriods(): array
    {
        $fromApplications = Application::select('academic_year', 'semester')->distinct();
        $calendar = SemesterPeriod::all()->keyBy(fn ($p) => "{$p->academic_year}|{$p->semester}");
        $current = app(SemesterPeriodService::class)->current();
        $currentKey = $current ? "{$current->academic_year}|{$current->semester}" : null;

        return Assignment::select('academic_year', 'semester')
            ->distinct()
            ->union($fromApplications)
            ->get()
            ->map(fn ($row) => ['academic_year' => $row->academic_year, 'semester' => $row->semester])
            ->merge($calendar->map(fn ($p) => ['academic_year' => $p->academic_year, 'semester' => $p->semester])->values())
            ->filter(fn ($p) => $p['academic_year'] && $p['semester'])
            ->unique(fn ($p) => $p['academic_year'] . '|' . $p['semester'])
            ->sortByDesc(function ($p) use ($calendar, $currentKey) {
                $key = $p['academic_year'] . '|' . $p['semester'];
                if ($key === $currentKey) {
                    return '9999-99-99';
                }

                return $calendar->get($key)?->start_date?->toDateString() ?? self::usualStart($p['academic_year'], $p['semester']);
            })
            ->values()
            ->toArray();
    }

    /** When a term normally starts, for terms not on the DSA calendar. */
    private static function usualStart(string $academicYear, string $semester): string
    {
        [$first, $second] = array_pad(array_map('intval', explode('-', $academicYear)), 2, 0);

        return match ($semester) {
            '1st Semester' => "$first-08-01",
            '2nd Semester' => "$second-01-01",
            'Summer' => "$second-06-01",
            default => "$first-01-01",
        };
    }

    public function getAdminOverview(string $academicYear, string $semester): array
    {
        // Every count below excludes records whose owning user has been
        // soft-deleted (whereHas('user') respects the SoftDeletes scope), so the
        // dashboard stays consistent with the filtered listings.
        $statusCounts = Application::whereHas('user')
            ->where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $totalVerifiedHours = TimeLog::whereHas('user')->whereHas('assignment', fn ($q) =>
            $q->where('academic_year', $academicYear)->where('semester', $semester)
        )->where('status', 'verified')
            ->sum('duration_hours');

        $pendingVerifications = TimeLog::whereHas('user')->whereHas('assignment', fn ($q) =>
            $q->where('academic_year', $academicYear)->where('semester', $semester)
        )->where('status', 'pending_verification')
            ->count();

        $officeDistribution = Assignment::with('office')
            ->whereHas('user')
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

        $monthlyStats = Application::whereHas('user')
            ->where('academic_year', $academicYear)
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
        $applicantsByCollege = Application::whereHas('user')
            ->where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->join('student_profiles', 'student_profiles.user_id', '=', 'applications.user_id')
            ->selectRaw("student_profiles.college as college, COUNT(*) as applicant_count,
                SUM(CASE WHEN applications.status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN applications.status = 'rejected' THEN 1 ELSE 0 END) as rejected")
            ->groupBy('student_profiles.college')
            ->orderByDesc('applicant_count')
            ->get()
            ->map(fn ($row) => [
                'college' => $row->college,
                'applicant_count' => (int) $row->applicant_count,
                // Split for the dashboard's stacked bars; the rest are still in review.
                'approved' => (int) $row->approved,
                'rejected' => (int) $row->rejected,
                'pending' => (int) $row->applicant_count - (int) $row->approved - (int) $row->rejected,
            ])
            ->toArray();

        // Active recipients grouped by their college (from the student profile), period-scoped.
        $recipientsByCollege = Assignment::whereHas('user')
            ->where('assignments.academic_year', $academicYear)
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
        $weeklyHours = TimeLog::whereHas('user')->whereHas('assignment', fn ($q) =>
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

        // A release is final: every live stub is money released (legacy payouts included).
        $releasedTotal = (float) StipendHistory::whereHas('recipient')
            ->where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->whereIn('status', StipendHistory::LIVE_STATUSES)
            ->sum('amount');
        // Payable now and not released yet, with signature + end-of-term report in (any term).
        $readyToRelease = collect(app(StipendService::class)->eligibleRecipients())
            ->filter(fn ($row) => $row['has_signature'] && $row['narrative_submitted'])
            ->count();

        // System-wide totals for the dashboard headline cards (not period-scoped),
        // so they always reflect the current state across all academic years.
        $totalApplicationsAll = Application::whereHas('user')->count();
        $activeRecipientsAll = Assignment::whereHas('user')->where('status', 'active')->count();
        $pendingApplicationsAll = Application::whereHas('user')->whereIn('status', [
            'submitted', 'under_review', 'interview_scheduled',
        ])->count();
        $totalOffices = Office::where('is_active', true)->count();

        $officeDistributionAll = Assignment::with('office')
            ->whereHas('user')
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

        $requiredHoursAll = (float) Assignment::whereHas('user')->where('status', 'active')->sum('required_hours');
        // Same placements on both sides: a renewed recipient's past-term hours must
        // not count toward the current terms' completion.
        $verifiedHoursActive = (float) TimeLog::whereHas('user')
            ->where('status', 'verified')
            ->whereHas('assignment', fn ($q) => $q->where('status', 'active'))
            ->sum('duration_hours');
        $avgCompletionRate = $requiredHoursAll > 0
            ? round(min(($verifiedHoursActive / $requiredHoursAll) * 100, 100), 1)
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
                'total_released' => $releasedTotal,
                'ready_to_release' => $readyToRelease,
            ],
            // The banner's "Today:" list: work waiting for an admin, each linking to its page.
            'tasks' => $this->tasks($academicYear, $semester, $readyToRelease),
        ];
    }

    /**
     * What is waiting for an admin, in the order it's usually handled; kinds with nothing
     * waiting are left out. Per-term ones follow the selected term; interviews are today's
     * (Manila), concerns and stipends whatever is open now.
     *
     * @return list<array{key: string, count: int, label: string, href: string}>
     */
    private function tasks(string $academicYear, string $semester, int $stipendsReady): array
    {
        $term = fn () => Application::whereHas('user')->where('academic_year', $academicYear)->where('semester', $semester);
        $plural = fn (int $n, string $one, string $many) => $n === 1 ? $one : $many;

        $applications = $term()->where('type', '!=', 'renewal')
            ->whereIn('status', ['submitted', 'under_review', 'interview_scheduled'])->count();

        // Renewals the admin can approve now (blocked ones wait on the student or supervisor).
        $readiness = app(RenewalReadinessService::class);
        $renewals = $term()->where('type', 'renewal')->where('status', 'submitted')->get()
            ->filter(fn (Application $a) => RenewalReadinessService::hasCor($a) && ($readiness->check($a)['ready'] ?? false))
            ->count();

        $today = now(SemesterPeriod::TIMEZONE);
        $interviews = Interview::where('status', 'scheduled')
            ->whereBetween('scheduled_at', [$today->copy()->startOfDay()->utc(), $today->copy()->endOfDay()->utc()])
            ->whereHas('application.user')
            ->count();

        // Approved students of this term still without an office for it.
        $needOffice = $term()->where('type', '!=', 'renewal')->where('status', 'approved')
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('assignments')
                ->whereColumn('assignments.user_id', 'applications.user_id')
                ->where('assignments.academic_year', $academicYear)->where('assignments.semester', $semester)
                ->where('assignments.status', 'active'))
            ->count();

        $concerns = Concern::where('status', Concern::STATUS_OPEN)->count();

        return array_values(array_filter([
            ['key' => 'applications', 'count' => $applications, 'label' => "{$applications} " . $plural($applications, 'application to review', 'applications to review'), 'href' => '/admin/applications'],
            ['key' => 'renewals', 'count' => $renewals, 'label' => "{$renewals} " . $plural($renewals, 'renewal ready to approve', 'renewals ready to approve'), 'href' => '/admin/applications?type=renewal'],
            ['key' => 'stipends', 'count' => $stipendsReady, 'label' => "{$stipendsReady} " . $plural($stipendsReady, 'stipend to release', 'stipends to release'), 'href' => '/admin/stipend'],
            ['key' => 'interviews', 'count' => $interviews, 'label' => "{$interviews} " . $plural($interviews, 'interview today', 'interviews today'), 'href' => '/admin/interviews'],
            ['key' => 'placements', 'count' => $needOffice, 'label' => "{$needOffice} approved, need an office", 'href' => '/admin/assignments'],
            ['key' => 'concerns', 'count' => $concerns, 'label' => "{$concerns} " . $plural($concerns, 'concern waiting for a reply', 'concerns waiting for a reply'), 'href' => '/admin/concerns'],
        ], fn ($t) => $t['count'] > 0));
    }
}
