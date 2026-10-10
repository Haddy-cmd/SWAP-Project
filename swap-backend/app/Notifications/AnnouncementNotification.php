<?php

namespace App\Notifications;

use App\Models\Announcement;
use Illuminate\Notifications\Notification;

/**
 * The in-portal copy of an announcement (bell + Notifications page). The email
 * copy goes out separately in Bcc batches (AnnouncementMail), so one send is a
 * handful of mail calls instead of one per recipient.
 */
class AnnouncementNotification extends Notification
{
    public function __construct(private readonly Announcement $announcement) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Announcement: ' . $this->announcement->title,
            'message' => $this->announcement->message,
            'type' => 'announcement',
            'attachments' => $this->announcement->attachments->map->summary()->values()->all(),
            // Keep this key LAST: AnnouncementService::delete() finds the copies by `"announcement_id":ID}`.
            'announcement_id' => $this->announcement->id,
        ];
    }
}
