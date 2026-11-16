<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

/** A clocked-in recipient was first seen outside their office: return before the deadline. */
class LeftPremisesNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    private function time(string $key): string
    {
        return Carbon::parse($this->data[$key])->timezone('Asia/Manila')->format('g:i A');
    }

    private function message(): string
    {
        return "You left {$this->data['office']} at {$this->time('left_at')} while clocked in. Your shift timer is paused "
            . "and the time away doesn't count. Return by {$this->time('deadline')} or you'll be clocked out as of {$this->time('left_at')}.";
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject('You left the office premises')
            ->greeting("Dear {$notifiable->name},")
            ->line($this->message())
            ->action('Open Hours & Attendance', \App\Support\Frontend::url('/recipient/attendance'))
            ->line('If you are still at the office, your phone’s GPS may be off — move near a window or outdoors.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'You left the office premises',
            'message' => $this->message(),
            'type' => 'attendance',
            'log_id' => $this->data['log_id'] ?? null,
            'deadline' => $this->data['deadline'] ?? null,
        ];
    }
}
