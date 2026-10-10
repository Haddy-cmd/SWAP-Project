<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\StipendRequirementsReminderNotification;
use App\Support\AfterCommit;
use Illuminate\Support\Carbon;

/**
 * Admin → Stipend → "Can't release yet" → Remind: a recipient whose stipend is payable but
 * who hasn't saved a signature or submitted the end-of-term report gets a bell + email naming
 * exactly what's missing — at most once per Manila day (an audit row marks each reminder).
 */
class StipendReminderService
{
    public const ACTION = 'stipend_reminder_sent';

    public const SIGNATURE = 'Save your digital signature on your Profile';
    public const REPORT = 'Submit your end-of-term report on the Hours & Attendance page';

    public function __construct(private readonly StipendService $stipends) {}

    /** @return list<string> what this payable row still needs, in the order the release checks it */
    public static function missing(array $row): array
    {
        return array_values(array_filter([
            empty($row['has_signature']) ? self::SIGNATURE : null,
            empty($row['narrative_submitted']) ? self::REPORT : null,
        ]));
    }

    /**
     * @param  list<int>|null  $userIds  null = every blocked recipient
     * @return array{reminded: int, already_today: int, not_blocked: int}
     */
    public function remind(?array $userIds, User $admin): array
    {
        $todayStart = Carbon::now('Asia/Manila')->startOfDay()->utc();
        $blocked = collect($this->stipends->eligibleRecipients())
            ->filter(fn ($row) => self::missing($row) !== [])
            ->groupBy('user_id');

        $wanted = $userIds === null ? $blocked->keys()->all() : array_values(array_unique(array_map('intval', $userIds)));
        $reminded = 0;
        $already = 0;
        $notBlocked = 0;

        foreach ($wanted as $userId) {
            $rows = $blocked->get($userId);
            $user = $rows ? User::find($userId) : null;
            if (!$rows || !$user) {
                $notBlocked++;
                continue;
            }

            $sentToday = AuditLog::where('action', self::ACTION)
                ->where('auditable_type', User::class)->where('auditable_id', $user->id)
                ->where('created_at', '>=', $todayStart)
                ->exists();
            if ($sentToday) {
                $already++;
                continue;
            }

            $missing = array_values(array_unique($rows->flatMap(fn ($r) => self::missing($r))->all()));
            $term = $rows->map(fn ($r) => "{$r['semester']} {$r['academic_year']}")->unique()->join(', ');

            AuditLog::record(self::ACTION, $user, null, ['missing' => $missing, 'term' => $term], $admin->id);
            $data = ['missing' => $missing, 'term' => $term];
            AfterCommit::quietly(fn () => $user->notify(new StipendRequirementsReminderNotification($data)),
                'Stipend requirements reminder', ['user_id' => $user->id]);
            $reminded++;
        }

        return ['reminded' => $reminded, 'already_today' => $already, 'not_blocked' => $notBlocked];
    }
}
