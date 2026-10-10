<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\VerificationReminderNotification;
use App\Support\AfterCommit;
use Illuminate\Support\Carbon;

/**
 * Admin → Analytics → Supervisors → "Remind busy supervisors": a supervisor with many hour
 * logs waiting, or one waiting long, gets an in-app + email reminder — at most once per
 * Manila day (an audit row marks each reminder).
 */
class SupervisorReminderService
{
    /** "Busy": this many logs waiting… */
    public const BUSY_PENDING = 10;

    /** …or the oldest waiting this many days. Mirrored in the frontend's Supervisors tab. */
    public const BUSY_DAYS = 3;

    public const ACTION = 'verification_reminder_sent';

    public function __construct(private readonly ProgramInsightsService $insights) {}

    public static function isBusy(int $pending, ?int $oldestDays): bool
    {
        return $pending > 0 && ($pending >= self::BUSY_PENDING || ($oldestDays ?? 0) >= self::BUSY_DAYS);
    }

    /** @return array{reminded: int, already_today: int} */
    public function remindBusy(string $academicYear, string $semester, User $admin): array
    {
        $term = "{$semester} {$academicYear}";
        $todayStart = Carbon::now('Asia/Manila')->startOfDay()->utc();
        $reminded = 0;
        $already = 0;

        foreach ($this->insights->workload($academicYear, $semester) as $row) {
            if (!self::isBusy($row['pending'], $row['oldest_pending_days'])) {
                continue;
            }
            $supervisor = User::where('role', 'supervisor')->find($row['supervisor_id']);
            if (!$supervisor) {
                continue; // removed since
            }

            $sentToday = AuditLog::where('action', self::ACTION)
                ->where('auditable_type', User::class)->where('auditable_id', $supervisor->id)
                ->where('created_at', '>=', $todayStart)
                ->exists();
            if ($sentToday) {
                $already++;
                continue;
            }

            AuditLog::record(self::ACTION, $supervisor, null, [
                'pending' => $row['pending'], 'oldest_days' => $row['oldest_pending_days'], 'term' => $term,
            ], $admin->id);

            $data = ['pending' => $row['pending'], 'oldest_days' => $row['oldest_pending_days'], 'term' => $term];
            AfterCommit::quietly(fn () => $supervisor->notify(new VerificationReminderNotification($data)),
                'Verification reminder', ['supervisor_id' => $supervisor->id]);
            $reminded++;
        }

        return ['reminded' => $reminded, 'already_today' => $already];
    }
}
