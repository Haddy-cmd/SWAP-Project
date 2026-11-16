<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

/** The recipient stayed away past the grace period and was clocked out automatically. */
class AutoClockedOutNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    private function message(): string
    {
        $at = isset($this->data['time_out'])
            ? Carbon::parse($this->data['time_out'])->timezone('Asia/Manila')->format('g:i A')
            : 'just now';
        $office = $this->data['office'] ?? 'your office';

        return "You were clocked out automatically at {$at} because you were away from {$office} "
            . "for {$this->data['minutes']} minutes. Your hours up to then were saved for your supervisor to verify.";
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject('You were clocked out automatically')
            ->greeting("Dear {$notifiable->name},")
            ->line($this->message())
            ->action('View your hours', \App\Support\Frontend::url('/recipient/attendance'))
            ->line('If this was a GPS error, tell your supervisor.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Clocked out automatically',
            'message' => $this->message(),
            'type' => 'attendance',
            'log_id' => $this->data['log_id'] ?? null,
        ];
    }
}
