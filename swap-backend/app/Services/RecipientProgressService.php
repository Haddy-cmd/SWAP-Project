<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\SemesterPeriod;
use App\Models\StipendHistory;
use App\Models\TimeLog;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Recipient dashboard / Hours: where the student stands on the current placement — pace
 * (the same rule supervisors see), a forecast, an hours breakdown, and a checklist of what
 * the stipend and the renewal still need, following the release and renewal rules.
 */
class RecipientProgressService
{
    /** The forecast's "current pace": hours rendered over this many recent days. */
    public const RECENT_DAYS = 28;

    public function forUser(User $user): ?array
    {
        $assignment = Assignment::with('termReport')
            ->withPromissoryFlags()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();
        if (!$assignment) {
            return null;
        }

        $logs = TimeLog::where('assignment_id', $assignment->id)
            ->whereNotNull('time_out')
            ->orderByDesc('time_in')
            ->get(['id', 'date', 'time_in', 'duration_hours', 'status', 'is_manual', 'rejection_reason']);
        $hours = fn ($set) => round((float) $set->sum('duration_hours'), 2);
        $live = $logs->where('status', '!=', 'rejected');
        $verified = $hours($logs->where('status', 'verified'));
        $pending = $hours($logs->where('status', 'pending_verification'));
        $required = (float) $assignment->required_hours;

        $stub = StipendHistory::where('user_id', $user->id)
            ->where('academic_year', $assignment->academic_year)
            ->where('semester', $assignment->semester)
            ->where('status', '!=', StipendHistory::STATUS_VOID)
            ->latest('id')
            ->first(['id', 'status', 'amount']);

        return [
            'term' => "{$assignment->semester} {$assignment->academic_year}",
            'end_date' => $assignment->effectiveEndDate()?->toDateString(),
            'pace' => $assignment->paceStatus(),
            'forecast' => $this->forecast($assignment, $live, $required, $verified, $pending),
            'breakdown' => [
                'verified_hours' => $verified,
                'pending_hours' => $pending,
                'rejected_hours' => $hours($logs->where('status', 'rejected')),
                'bonus_hours' => $hours($live->where('is_manual', true)),
                'days_on_duty' => $live->pluck('date')->map(fn ($d) => Carbon::parse($d)->toDateString())->unique()->count(),
                'avg_session_hours' => ($sessions = $live->where('is_manual', false))->isNotEmpty()
                    ? round((float) $sessions->avg('duration_hours'), 2) : null,
                'rejected_logs' => $logs->where('status', 'rejected')->take(10)->map(fn (TimeLog $l) => [
                    'id' => $l->id,
                    'date' => Carbon::parse($l->date)->toDateString(),
                    'hours' => round((float) $l->duration_hours, 2),
                    'reason' => $l->rejection_reason,
                ])->values()->all(),
            ],
            'checklist' => $this->checklist($user, $assignment, $required, $verified, $stub),
        ];
    }

    /**
     * Hours per week still needed to finish by the term's end, and when the student would
     * finish at their recent pace. Pending hours are counted as they're usually verified.
     */
    private function forecast(Assignment $assignment, $live, float $required, float $verified, float $pending): array
    {
        $today = Carbon::now(SemesterPeriod::TIMEZONE)->startOfDay();
        $end = $assignment->effectiveEndDate();
        $endDay = $end ? Carbon::parse($end->toDateString(), SemesterPeriod::TIMEZONE)->startOfDay() : null;
        $outstanding = round(max(0.0, $required - $verified - $pending), 2);

        $since = $today->copy()->subDays(self::RECENT_DAYS - 1)->toDateString();
        $recent = (float) $live->filter(fn ($l) => Carbon::parse($l->date)->toDateString() >= $since)->sum('duration_hours');
        $weekly = round($recent / (self::RECENT_DAYS / 7), 2);

        $daysLeft = $endDay && $endDay->gte($today) ? (int) $today->diffInDays($endDay) + 1 : 0;
        $weeksLeft = round($daysLeft / 7, 1);
        $projected = $outstanding > 0 && $weekly > 0
            ? $today->copy()->addDays((int) ceil($outstanding / $weekly * 7))
            : null;

        return [
            'outstanding_hours' => $outstanding,
            'weeks_left' => $endDay ? $weeksLeft : null,
            'hours_per_week_needed' => $outstanding > 0 && $daysLeft > 0 ? round($outstanding / max($daysLeft / 7, 1 / 7), 1) : null,
            'recent_weekly_average' => $weekly,
            'projected_finish' => $projected?->toDateString(),
            'on_time' => $outstanding <= 0 ? true : ($projected && $endDay ? $projected->lte($endDay) : null),
        ];
    }

    /**
     * What the stipend and the renewal still need, in the order the system checks them.
     * Each item: key, state (done | todo | waiting | blocked), label, link.
     */
    private function checklist(User $user, Assignment $a, float $required, float $verified, ?StipendHistory $stub): array
    {
        $met = $required <= 0 || $verified >= $required;
        $ended = ($end = TermStatusService::termEndsAt($a)) !== null && $end->isPast();
        $short = round(max(0.0, $required - $verified), 2);
        $item = fn (string $key, string $state, string $label, ?string $link = null) => compact('key', 'state', 'label', 'link');

        $hours = match (true) {
            $met => $item('hours', 'done', 'Required hours completed'),
            (bool) $a->has_approved_promissory => $item('hours', 'done', "Short {$short} hours — promissory note approved", '/recipient/stipend'),
            (bool) $a->has_pending_promissory => $item('hours', 'waiting', 'Promissory note waiting for your supervisor’s review', '/recipient/stipend'),
            $ended => $item('hours', 'todo', "Short {$short} hours — file a promissory note", '/recipient/stipend'),
            default => $item('hours', 'todo', "{$short} hours to go", '/recipient/attendance'),
        };

        $signature = match (true) {
            !$user->signature_image_path => $item('signature', 'todo', 'Save your digital signature', '/profile'),
            $user->signatureFileMissing() => $item('signature', 'todo', 'Your signature image was lost — draw it again', '/profile'),
            default => $item('signature', 'done', 'Digital signature saved'),
        };

        $report = $a->termReport;
        $reportItem = match (true) {
            !$report?->submitted_at => $item('report', 'todo', 'Submit your end-of-term narrative report', '/recipient/hours'),
            !$report->reviewed_at => $item('report', 'waiting', 'End-of-term report submitted — waiting for your supervisor to accept it', '/recipient/hours'),
            (bool) $report->renewal_eligible => $item('report', 'done', 'End-of-term report accepted — eligible for renewal', '/recipient/hours'),
            default => $item('report', 'blocked', 'End-of-term report accepted — marked not eligible for renewal', '/recipient/hours'),
        };

        $stipend = match ($stub?->status) {
            'claimed', 'released' => $item('stipend', 'done', 'Stipend claimed', '/recipient/stipend'),
            'certified', 'pending' => $item('stipend', 'todo', 'Claim stub ready — bring it to the Banking Office', '/recipient/stipend'),
            default => $item('stipend', 'waiting', 'Stipend released by the DSA once the items above are done', '/recipient/stipend'),
        };

        return [$hours, $signature, $reportItem, $stipend];
    }
}
