<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class HoursVerifiedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $hours = $this->data['duration_hours'] ?? 0;

        return (new MailMessage())
            ->subject('Service Hours Verified')
            ->greeting("Dear {$notifiable->name},")
            ->line("Your attendance log of {$hours} hours has been verified by your supervisor.")
            ->action('View Hours', config('app.frontend_url') . '/recipient/hours')
            ->line('Keep up the great work!');
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
