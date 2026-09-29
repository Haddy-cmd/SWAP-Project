<?php

namespace App\Notifications;

use App\Models\Concern;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/** In-app heads-up to the admins that a new concern is waiting in the inbox. */
class ConcernSubmittedNotification extends Notification implements ShouldQueue
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
            'title' => 'New concern',
            'message' => ($this->concern->user?->name ?? 'A user') . " sent a concern: \"{$this->concern->subject}\".",
            'type' => 'concern',
            'concern_id' => $this->concern->id,
        ];
    }
}
