<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Assignment;
use App\Models\Office;
use App\Models\PromissoryNote;
use App\Models\SemesterPeriod;
use App\Models\StipendHistory;
use App\Models\TimeLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Admin → Analytics → Program insights for one term: how the term ended, renewals, money,
 * attendance integrity, supervisor workload, the application funnel and office use.
 * Everything is read from data the system already records, in aggregate queries;
 * records of soft-deleted users are left out, as in the overview.
 */
class ProgramInsightsService
{
    private const WAITING = ['submitted', 'under_review', 'interview_scheduled'];

    public function __construct(
        private readonly RenewalReadinessService $readiness,
        private readonly StipendService $stipends,
    ) {}

    public function forTerm(string $academicYear, string $semester): array
    {
        return [
            'term_results' => $this->termResults($academicYear, $semester),
            'renewals' => $this->renewals($academicYear, $semester),
            'stipend' => $this->stipend($academicYear, $semester),
            'integrity' => $this->integrity($academicYear, $semester),
            'workload' => $this->workload($academicYear, $semester),
            'funnel' => $this->funnel($academicYear, $semester),
            'offices' => $this->offices($academicYear, $semester),
        ];
    }

    /** The term's placements (current or finished; suspended ones aren't measured). */
    private function placements(string $ay, string $sem): Builder
    {
        return Assignment::whereHas('user')
            ->where('assignments.academic_year', $ay)
            ->where('assignments.semester', $sem)
            ->whereIn('assignments.status', ['active', 'completed']);
    }

    private function termResults(string $ay, string $sem): array
    {
        $verdicts = $this->placements($ay, $sem)
            ->selectRaw("COALESCE(term_status, 'in_progress') as verdict, COUNT(*) as n, COALESCE(SUM(deficient_hours), 0) as short")
            ->groupByRaw("COALESCE(term_status, 'in_progress')")
            ->get()
            ->keyBy('verdict');

        $notes = PromissoryNote::whereHas('student')
            ->where('academic_year', $ay)
            ->where('semester', $sem)
            ->selectRaw('status, COUNT(*) as n')
            ->groupBy('status')
            ->pluck('n', 'status');

        $carried = (int) Assignment::whereIn('carried_from_assignment_id', $this->placements($ay, $sem)->select('assignments.id'))
            ->sum('carried_over_hours');

        return [
            'placements' => (int) $verdicts->sum('n'),
            'qualified' => (int) ($verdicts[Assignment::TERM_QUALIFIED]->n ?? 0),
            'deficient' => (int) ($verdicts[Assignment::TERM_DEFICIENT]->n ?? 0),
            'in_progress' => (int) ($verdicts['in_progress']->n ?? 0),
            'deficient_hours' => round((float) ($verdicts[Assignment::TERM_DEFICIENT]->short ?? 0), 2),
            'promissory' => [
                'filed' => (int) $notes->sum(),
                'approved' => (int) ($notes[PromissoryNote::STATUS_APPROVED] ?? 0),
                'rejected' => (int) ($notes[PromissoryNote::STATUS_REJECTED] ?? 0),
                'pending' => (int) ($notes[PromissoryNote::STATUS_PENDING] ?? 0),
            ],
            'carried_hours' => $carried,
        ];
    }

    /**
     * Renewal applications for this term, why the waiting ones can't be approved yet
     * (the same check the approval runs), and the renewal rate against the recipients
     * of the semester period before this one.
     */
    private function renewals(string $ay, string $sem): array
    {
        $renewals = Application::whereHas('user')
            ->with('documents')
            ->where('type', 'renewal')
            ->where('academic_year', $ay)
            ->where('semester', $sem)
            ->get();

        $blocked = [];
        foreach ($renewals->whereIn('status', self::WAITING) as $application) {
            $reason = $this->blockReason($this->readiness->check($application), $application);
            $blocked[$reason] = ($blocked[$reason] ?? 0) + 1;
        }
        arsort($blocked);

        $approved = $renewals->where('status', 'approved')->count();
        $previous = $this->previousPeriod($ay, $sem);
        $previousRecipients = $previous
            ? Assignment::whereHas('user')
                ->where('academic_year', $previous->academic_year)
                ->where('semester', $previous->semester)
                ->whereIn('status', ['active', 'completed'])
                ->distinct()
                ->count('user_id')
            : null;

        return [
            'submitted' => $renewals->count(),
            'approved' => $approved,
            'rejected' => $renewals->where('status', 'rejected')->count(),
            'waiting' => $renewals->whereIn('status', self::WAITING)->count(),
            'waiting_reasons' => collect($blocked)->map(fn ($n, $reason) => ['reason' => $reason, 'count' => $n])->values()->all(),
            'previous_term' => $previous ? "{$previous->semester} {$previous->academic_year}" : null,
            'previous_recipients' => $previousRecipients,
            'renewal_rate' => $previousRecipients ? round($approved / $previousRecipients * 100, 1) : null,
        ];
    }

    /** The first thing standing between a waiting renewal and its approval (RenewalReadinessService order). */
    private function blockReason(?array $check, Application $application): string
    {
        if ($check === null) {
            return RenewalReadinessService::hasCor($application) ? 'No earlier placement' : 'No updated COR';
        }

        return match (true) {
            !$check['cor_attached'] => 'No updated COR',
            $check['payment'] === 'owed' => 'Stipend not released yet',
            $check['payment'] === 'unpaid' => 'Unpaid, no approved promissory note',
            !$check['report']['submitted'] => 'No end-of-term report',
            $check['hours_met'] && !$check['report']['accepted'] => 'Report not accepted yet',
            $check['report']['accepted'] && $check['report']['renewal_eligible'] === false => 'Marked not eligible',
            default => 'Ready to approve',
        };
    }

    private function previousPeriod(string $ay, string $sem): ?SemesterPeriod
    {
        $period = SemesterPeriod::where('academic_year', $ay)->where('semester', $sem)->first();

        return $period
            ? SemesterPeriod::where('end_date', '<', $period->start_date)->orderByDesc('end_date')->first()
            : null;
    }

    /**
     * Money released this term (a release is final; legacy Banking Office payouts count
     * too), how much went through promissory notes, what was voided, and who is payable
     * but not released yet — split into ready (signature + report in) and still missing one.
     */
    private function stipend(string $ay, string $sem): array
    {
        $term = fn () => StipendHistory::whereHas('recipient')->where('academic_year', $ay)->where('semester', $sem);
        $released = $term()->whereIn('status', StipendHistory::LIVE_STATUSES);

        $eligible = collect($this->stipends->eligibleRecipients())
            ->filter(fn ($row) => $row['academic_year'] === $ay && $row['semester'] === $sem);
        $ready = $eligible->filter(fn ($row) => $row['has_signature'] && $row['narrative_submitted'])->count();

        return [
            'released' => (clone $released)->count(),
            'released_amount' => round((float) (clone $released)->sum('amount'), 2),
            'via_promissory' => (clone $released)->where('via_promissory', true)->count(),
            'voided' => $term()->where('status', StipendHistory::STATUS_VOID)->count(),
            'ready_to_release' => $ready,
            'missing_requirements' => $eligible->count() - $ready,
        ];
    }

    /** Per office: flagged locations, automatic clock-outs, rejected logs, logs with no task description. */
    private function integrity(string $ay, string $sem): array
    {
        $rows = TimeLog::whereHas('user')
            ->join('assignments', 'assignments.id', '=', 'time_logs.assignment_id')
            ->where('assignments.academic_year', $ay)
            ->where('assignments.semester', $sem)
            ->selectRaw("assignments.office_id as office_id,
                COUNT(*) as logs,
                SUM(CASE WHEN time_logs.location_flagged THEN 1 ELSE 0 END) as flagged,
                SUM(CASE WHEN time_logs.clocked_out_reason IN ('auto', 'auto_stale') THEN 1 ELSE 0 END) as auto_clock_outs,
                SUM(CASE WHEN time_logs.status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN time_logs.time_out IS NOT NULL AND NOT COALESCE(time_logs.is_manual, false)
                    AND NOT EXISTS (SELECT 1 FROM narrative_reports nr WHERE nr.time_log_id = time_logs.id)
                    THEN 1 ELSE 0 END) as missing_task")
            ->groupBy('assignments.office_id')
            ->get();

        $names = Office::whereIn('id', $rows->pluck('office_id'))->pluck('name', 'id');

        return $rows->map(fn ($r) => [
            'office' => $names[$r->office_id] ?? 'Unknown',
            'logs' => (int) $r->logs,
            'flagged' => (int) $r->flagged,
            'auto_clock_outs' => (int) $r->auto_clock_outs,
            'rejected' => (int) $r->rejected,
            'missing_task' => (int) $r->missing_task,
        ])->sortByDesc(fn ($r) => $r['flagged'] + $r['auto_clock_outs'] + $r['rejected'] + $r['missing_task'])->values()->all();
    }

    /**
     * Per supervisor: what waits for them (pending logs of the placements they're assigned
     * to, and how old the oldest is) and how quickly they verified this term's logs.
     */
    private function workload(string $ay, string $sem): array
    {
        $termLogs = fn () => TimeLog::whereHas('user')
            ->join('assignments', 'assignments.id', '=', 'time_logs.assignment_id')
            ->where('assignments.academic_year', $ay)
            ->where('assignments.semester', $sem);

        $pending = $termLogs()
            ->where('time_logs.status', 'pending_verification')
            ->selectRaw('assignments.supervisor_id as supervisor_id, COUNT(*) as n, COALESCE(SUM(time_logs.duration_hours), 0) as hours, MIN(time_logs.time_out) as oldest')
            ->groupBy('assignments.supervisor_id')
            ->get()
            ->keyBy('supervisor_id');

        $verified = $termLogs()
            ->where('time_logs.status', 'verified')
            ->whereNotNull('time_logs.verified_by')
            ->whereNotNull('time_logs.verified_at')
            ->whereNotNull('time_logs.time_out')
            ->whereRaw('NOT COALESCE(time_logs.is_manual, false)')
            ->selectRaw('time_logs.verified_by as supervisor_id, COUNT(*) as n, AVG(EXTRACT(EPOCH FROM (time_logs.verified_at - time_logs.time_out))) / 3600 as avg_hours')
            ->groupBy('time_logs.verified_by')
            ->get()
            ->keyBy('supervisor_id');

        $ids = $pending->keys()->merge($verified->keys())->filter()->unique();
        $users = User::withTrashed()->with('profile')->whereIn('id', $ids)->where('role', 'supervisor')->get()->keyBy('id');

        return $users->map(function (User $u) use ($pending, $verified) {
            $p = $pending[$u->id] ?? null;
            $v = $verified[$u->id] ?? null;

            return [
                'supervisor_id' => $u->id,
                'name' => $u->profile?->full_name ?? $u->name,
                'pending' => (int) ($p->n ?? 0),
                'pending_hours' => round((float) ($p->hours ?? 0), 2),
                'oldest_pending_days' => $p?->oldest ? (int) \Illuminate\Support\Carbon::parse($p->oldest)->diffInDays(now()) : null,
                'verified' => (int) ($v->n ?? 0),
                'avg_verify_hours' => $v ? round((float) $v->avg_hours, 1) : null,
            ];
        })->sortByDesc('pending')->values()->all();
    }

    /** New applications for the term: from submission to decision, by college. */
    private function funnel(string $ay, string $sem): array
    {
        $apps = fn () => Application::whereHas('user')
            ->where('applications.academic_year', $ay)
            ->where('applications.semester', $sem)
            ->where(fn ($q) => $q->whereNull('applications.type')->orWhere('applications.type', '!=', 'renewal'));

        $byStatus = $apps()->selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status');
        $interviews = $apps()
            ->join('interviews', 'interviews.application_id', '=', 'applications.id')
            ->selectRaw("COUNT(DISTINCT applications.id) as interviewed, SUM(CASE WHEN interviews.status = 'no_show' THEN 1 ELSE 0 END) as no_shows")
            ->first();
        $avgDays = $apps()
            ->whereIn('status', ['approved', 'rejected'])
            ->whereNotNull('reviewed_at')
            ->selectRaw('AVG(EXTRACT(EPOCH FROM (reviewed_at - applications.created_at))) / 86400 as days')
            ->value('days');
        $byCollege = $apps()
            ->join('student_profiles', 'student_profiles.user_id', '=', 'applications.user_id')
            ->selectRaw("COALESCE(student_profiles.college, '—') as college, COUNT(*) as total, SUM(CASE WHEN applications.status = 'approved' THEN 1 ELSE 0 END) as approved, SUM(CASE WHEN applications.status = 'rejected' THEN 1 ELSE 0 END) as rejected")
            ->groupBy('student_profiles.college')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($r) => ['college' => $r->college, 'total' => (int) $r->total, 'approved' => (int) $r->approved, 'rejected' => (int) $r->rejected])
            ->all();

        return [
            'submitted' => (int) $byStatus->sum(),
            'interviewed' => (int) ($interviews->interviewed ?? 0),
            'approved' => (int) ($byStatus['approved'] ?? 0),
            'rejected' => (int) ($byStatus['rejected'] ?? 0),
            'waiting' => (int) collect(self::WAITING)->sum(fn ($s) => $byStatus[$s] ?? 0),
            'no_shows' => (int) ($interviews->no_shows ?? 0),
            'avg_days_to_decision' => $avgDays !== null ? round((float) $avgDays, 1) : null,
            'by_college' => $byCollege,
        ];
    }

    /** Active offices: capacity against this term's current placements, hours and completion. */
    private function offices(string $ay, string $sem): array
    {
        $placements = $this->placements($ay, $sem)
            ->withSum(['timeLogs as verified_sum' => fn ($q) => $q->where('status', 'verified')], 'duration_hours')
            ->get(['assignments.id', 'assignments.office_id', 'assignments.required_hours', 'assignments.status'])
            ->groupBy('office_id');

        return Office::where('is_active', true)->orderBy('name')->get(['id', 'name', 'max_recipients'])
            ->map(function (Office $o) use ($placements) {
                $rows = $placements->get($o->id, collect());
                $current = $rows->where('status', 'active')->count();
                $required = (float) $rows->sum('required_hours');
                $verified = (float) $rows->sum(fn ($a) => (float) $a->verified_sum);

                return [
                    'office' => $o->name,
                    'capacity' => (int) $o->max_recipients,
                    'filled' => $current,
                    'verified_hours' => round($verified, 2),
                    'avg_completion' => $required > 0 ? round(min(100, $verified / $required * 100), 1) : null,
                ];
            })->all();
    }
}
