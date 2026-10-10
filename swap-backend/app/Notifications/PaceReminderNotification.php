<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A supervisor nudges a recipient whose verified hours are behind the elapsed term. */
class PaceReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data, private readonly string $supervisorName) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    private static function h(float $v): string
    {
        return rtrim(rtrim(number_format($v, 1), '0'), '.') . 'h';
    }

    private function message(): string
    {
        $d = $this->data;

        // No end date to measure against → no hour figure for the gap.
        $gap = $d['deficit_hours'] > 0 ? self::h($d['deficit_hours']) . ' behind' : 'behind schedule';

        return "You're {$gap} for {$d['term']} — " . self::h($d['verified']) . ' of '
            . self::h($d['required']) . " verified. There's still time to catch up; talk to your supervisor if something is in the way.";
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject("You're Behind on Your Service Hours")
            ->greeting("Dear {$notifiable->name},")
            ->line($this->message())
            ->line("Sent by {$this->supervisorName}.")
            ->action('Open My Hours', \App\Support\Frontend::url('/recipient/attendance'));
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => "You're behind on your hours",
            'message' => $this->message(),
            'type' => 'attendance',
        ];
    }
}
