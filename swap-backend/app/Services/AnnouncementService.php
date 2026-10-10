<?php

namespace App\Services;

use App\Mail\AnnouncementMail;
use App\Models\Announcement;
use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\AnnouncementNotification;
use App\Support\TestTools;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
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

    /** Attachments: photos and office documents, up to 5 files of 10 MB each. */
    public const MAX_FILES = 5;
    public const MAX_FILE_KB = 10240;
    public const FILE_TYPES = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
    public const MSG_TOO_MANY_FILES = 'You can attach up to 5 files.';
    public const MSG_FILE_TOO_BIG = '%s is over 10 MB.';
    public const MSG_FILE_TYPE = 'Only photos, PDF, Word, Excel or PowerPoint files can be attached.';

    public static function activeRecipients(): Builder
    {
        return User::where('role', 'recipient')->where('is_active', true);
    }

    /** Active recipients whose email System Testing holds back right now (picked, emails off). */
    public static function emailMutedCount(): int
    {
        return self::activeRecipients()->whereNotNull('testing_added_at')->where('testing_email_muted', true)->count();
    }

    /** The sent history, newest first; `$search` matches the title or the message. */
    public function history(int $perPage = 15, ?string $search = null): LengthAwarePaginator
    {
        $term = trim((string) $search);

        return Announcement::with(['sender:id,name', 'attachments'])
            ->when($term !== '', fn ($q) => $q->where(fn ($w) => $w
                ->where('title', 'ilike', "%{$term}%")->orWhere('message', 'ilike', "%{$term}%")))
            ->latest()
            ->paginate($perPage);
    }

    /** @param  list<UploadedFile>  $files  photos and documents (validated by StoreAnnouncementRequest) */
    public function send(User $admin, string $title, string $message, array $files = []): Announcement
    {
        $recipients = self::activeRecipients()->get(['id', 'name', 'email', 'testing_added_at', 'testing_email_muted']);
        if ($recipients->isEmpty()) {
            throw new UnprocessableEntityHttpException(self::MSG_NO_RECIPIENTS);
        }

        $disk = config('filesystems.documents_disk', 'public');
        $stored = [];
        try {
            $announcement = DB::transaction(function () use ($admin, $title, $message, $recipients, $files, $disk, &$stored) {
                $announcement = Announcement::create([
                    'title' => trim($title),
                    'message' => trim($message),
                    'sent_by' => $admin->id,
                    'recipient_count' => $recipients->count(),
                ]);

                foreach (array_values($files) as $i => $file) {
                    $path = $file->store("announcements/{$announcement->id}", $disk);
                    $stored[] = $path;
                    $announcement->attachments()->create([
                        'file_name' => $file->getClientOriginalName(),
                        'file_path' => $path,
                        'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
                        'file_size' => $file->getSize(),
                        'is_image' => str_starts_with((string) $file->getMimeType(), 'image/'),
                        'position' => $i,
                    ]);
                }
                $announcement->load('attachments');

                // In-portal copies: plain inserts, all or nothing with the record.
                Notification::send($recipients, new AnnouncementNotification($announcement));
                AuditLog::record('announcement_sent', $announcement, null,
                    $announcement->only(['title', 'recipient_count'])
                        + ($announcement->attachments->isNotEmpty() ? ['attachments' => $announcement->attachments->pluck('file_name')->all()] : []),
                    $admin->id);

                return $announcement;
            });
        } catch (\Throwable $e) {
            // Nothing was sent: don't leave the uploaded files behind.
            if ($stored) {
                Storage::disk($disk)->delete($stored);
            }
            throw $e;
        }

        // Email after commit. A failed batch is logged and counted, never undoes
        // the announcement (everyone already has it in the portal).
        $emailed = 0;
        $to = config('mail.from.address');
        // System Testing's per-account email switch: muted accounts keep the portal copy only.
        $emails = $recipients->reject(fn (User $u) => TestTools::mutesEmail($u))->pluck('email')->filter();
        foreach ($emails->chunk(self::EMAIL_BATCH) as $batch) {
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

        return $announcement->load(['sender:id,name', 'attachments']);
    }

    /**
     * Remove a sent announcement: its history row and every recipient's portal copy.
     * Emails already delivered can't be recalled. Returns how many portal copies went.
     */
    public function delete(Announcement $announcement, User $admin): int
    {
        $files = $announcement->attachments()->pluck('file_path')->all();

        $removed = DB::transaction(function () use ($announcement, $admin) {
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

        // The rows went with the announcement (cascade); the files go once that is committed.
        if ($files) {
            Storage::disk(config('filesystems.documents_disk', 'public'))->delete($files);
        }

        return $removed;
    }
}
