<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The DSA reminds a busy supervisor that hour logs are waiting for verification. */
class VerificationReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    private function message(): string
    {
        $n = (int) ($this->data['pending'] ?? 0);
        $logs = $n === 1 ? '1 hour log' : "{$n} hour logs";
        $days = $this->data['oldest_days'] ?? null;
        $oldest = $days ? ' The oldest has waited ' . ($days === 1 ? '1 day' : "{$days} days") . '.' : '';

        return "You have {$logs} waiting for verification for {$this->data['term']}.{$oldest} Recipients' stipends depend on verified hours.";
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject('Hour Logs Waiting for You')
            ->greeting("Dear {$notifiable->name},")
            ->line($this->message())
            ->action('Verify Hours', \App\Support\Frontend::url('/supervisor/verifications'));
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Hour logs waiting for you',
            'message' => $this->message(),
            'type' => 'verification_reminder',
        ];
    }
}
