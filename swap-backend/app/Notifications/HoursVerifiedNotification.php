<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class HoursVerifiedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    // In-app only — no email is sent when hours are verified (it's a routine event;
    // the recipient sees it in their notifications and on the Hours page).
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Hours Verified',
            'message' => "Your attendance log of {$this->data['duration_hours']} hours has been verified.",
            'type' => 'attendance',
            'log_id' => $this->data['log_id'] ?? null,
        ];
    }
}
