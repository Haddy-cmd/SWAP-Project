<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class HoursRejectedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $feedback = $this->data['feedback'] ?? 'No feedback provided.';

        return (new MailMessage())
            ->subject('Service Hours Rejected')
            ->greeting("Dear {$notifiable->name},")
            ->line('Your attendance log has been rejected by your supervisor.')
            ->line("Feedback: {$feedback}")
            ->action('View Logs', config('app.frontend_url') . '/recipient/attendance')
            ->line('Please contact your supervisor if you have questions.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Hours Rejected',
            'message' => 'Your attendance log was rejected. Please review the feedback.',
            'type' => 'attendance',
            'log_id' => $this->data['log_id'] ?? null,
            'feedback' => $this->data['feedback'] ?? null,
        ];
    }
}
