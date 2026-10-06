<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\TimeLog;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Supervisor → Analytics & Reports → Overview. The report tables and their exports
 * are datasets under App\Reports, run by ReportExplorerService.
 */
class ReportService
{
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
}
