<?php

namespace App\Services;

use App\Mail\AnnouncementMail;
use App\Models\Announcement;
use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\AnnouncementNotification;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * Admin → Announcements: one message to every active recipient — approved students
 * still waiting for an office included (approval makes them recipients) — in the portal
 * and by email. Jobs run inline in production (QUEUE_CONNECTION=sync), so the email
 * goes out in Bcc batches — a few mail calls, not one per recipient — and nobody
 * sees the others' addresses.
 */
class AnnouncementService
{
    /** Recipients per email; well under provider per-message limits. */
    public const EMAIL_BATCH = 50;

    public const MSG_NO_RECIPIENTS = 'There are no active recipients to send this announcement to.';

    public static function activeRecipients(): Builder
    {
        return User::where('role', 'recipient')->where('is_active', true);
    }

    public function history(int $perPage = 15): LengthAwarePaginator
    {
        return Announcement::with('sender:id,name')->latest()->paginate($perPage);
    }

    public function send(User $admin, string $title, string $message): Announcement
    {
        $recipients = self::activeRecipients()->get(['id', 'name', 'email']);
        if ($recipients->isEmpty()) {
            throw new UnprocessableEntityHttpException(self::MSG_NO_RECIPIENTS);
        }

        $announcement = DB::transaction(function () use ($admin, $title, $message, $recipients) {
            $announcement = Announcement::create([
                'title' => trim($title),
                'message' => trim($message),
                'sent_by' => $admin->id,
                'recipient_count' => $recipients->count(),
            ]);

            // In-portal copies: plain inserts, all or nothing with the record.
            Notification::send($recipients, new AnnouncementNotification($announcement));
            AuditLog::record('announcement_sent', $announcement, null,
                $announcement->only(['title', 'recipient_count']), $admin->id);

            return $announcement;
        });

        // Email after commit. A failed batch is logged and counted, never undoes
        // the announcement (everyone already has it in the portal).
        $emailed = 0;
        $to = config('mail.from.address');
        foreach ($recipients->pluck('email')->filter()->chunk(self::EMAIL_BATCH) as $batch) {
            try {
                Mail::to($to)->bcc($batch->values()->all())->send(new AnnouncementMail($announcement));
                $emailed += $batch->count();
            } catch (\Throwable $e) {
                Log::warning('Announcement email batch failed', [
                    'announcement_id' => $announcement->id, 'batch_size' => $batch->count(), 'error' => $e->getMessage(),
                ]);
            }
        }
        $announcement->update(['emailed_count' => $emailed]);

        return $announcement->load('sender:id,name');
    }

    /**
     * Remove a sent announcement: its history row and every recipient's portal copy.
     * Emails already delivered can't be recalled. Returns how many portal copies went.
     */
    public function delete(Announcement $announcement, User $admin): int
    {
        return DB::transaction(function () use ($announcement, $admin) {
            // The portal copies are stored as JSON text ending in the announcement id.
            $removed = DB::table('notifications')
                ->where('type', AnnouncementNotification::class)
                ->where('data', 'like', '%"announcement_id":' . $announcement->id . '}')
                ->delete();

            AuditLog::record('announcement_deleted', $announcement,
                $announcement->only(['title', 'recipient_count', 'emailed_count']) + ['created_at' => $announcement->created_at?->toISOString()],
                ['notifications_removed' => $removed], $admin->id);
            $announcement->delete();

            return $removed;
        });
    }
}
