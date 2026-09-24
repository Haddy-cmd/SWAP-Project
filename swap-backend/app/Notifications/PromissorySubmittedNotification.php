<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PromissorySubmittedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $student = $this->data['student_name'] ?? 'A student';
        $lacking = number_format((float) ($this->data['lacking_hours'] ?? 0), 2);

        return (new MailMessage())
            ->subject('New Promissory Note Submitted')
            ->greeting("Dear {$notifiable->name},")
            ->line("{$student} submitted a promissory note for {$lacking} lacking service hour(s).")
            ->line('Please review it and set the hours they must render as soon as possible.')
            ->action('Review Promissory Notes', \App\Support\Frontend::url('/supervisor/promissory'));
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Promissory Note Submitted',
            'message' => ($this->data['student_name'] ?? 'A student').' submitted a promissory note for review.',
            'type' => 'promissory',
            'promissory_id' => $this->data['promissory_id'] ?? null,
        ];
    }
}
