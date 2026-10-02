<?php

namespace App\Notifications;

use App\Models\Concern;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/** In-app heads-up to the admins that the student added a reply to an open concern. */
class ConcernMessageNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly Concern $concern) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'New reply on a concern',
            'message' => ($this->concern->user?->name ?? 'A user') . " replied on \"{$this->concern->subject}\".",
            'type' => 'concern',
            'concern_id' => $this->concern->id,
        ];
    }
}
