<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\PaceReminderNotification;
use App\Support\AfterCommit;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Supervisor dashboard → Falling behind → bell: a student whose verified hours are behind the
 * elapsed term gets a bell + email, at most once per Manila day (an audit row marks each one).
 */
class PaceReminderService
{
    public const ACTION = 'pace_reminder_sent';

    public const MSG_TODAY = 'Already reminded today.';

    private static function todayStart(): Carbon
    {
        return Carbon::now('Asia/Manila')->startOfDay()->utc();
    }

    /** @param  Collection<int, int>|array<int>  $studentIds  @return array<int, true> students reminded today */
    public function remindedToday(Collection|array $studentIds): array
    {
        return AuditLog::where('action', self::ACTION)->where('auditable_type', User::class)
            ->whereIn('auditable_id', collect($studentIds)->all())
            ->where('created_at', '>=', self::todayStart())
            ->pluck('auditable_id')->mapWithKeys(fn ($id) => [(int) $id => true])->all();
    }

    public function remind(Assignment $assignment, User $supervisor): void
    {
        $student = $assignment->user;
        $pace = $assignment->paceStatus();
        if ($pace['status'] !== 'behind') {
            throw ValidationException::withMessages(['student' => ["{$student->name} isn't behind schedule."]]);
        }
        if (isset($this->remindedToday([$student->id])[$student->id])) {
            throw ValidationException::withMessages(['student' => [self::MSG_TODAY]]);
        }

        $verified = (float) $assignment->timeLogs()->where('status', 'verified')->sum('duration_hours');
        $data = [
            'deficit_hours' => (float) $pace['deficit_hours'],
            'verified' => round($verified, 2),
            'required' => (float) $assignment->required_hours,
            'term' => trim("{$assignment->semester} {$assignment->academic_year}"),
        ];

        AuditLog::record(self::ACTION, $student, null, $data, $supervisor->id);
        AfterCommit::quietly(fn () => $student->notify(new PaceReminderNotification($data, $supervisor->name)),
            'Pace reminder', ['user_id' => $student->id]);
    }
}
