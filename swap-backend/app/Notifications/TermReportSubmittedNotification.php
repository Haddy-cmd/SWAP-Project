<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A supervised student submitted their end-of-term report, waiting for the supervisor to accept it. */
class TermReportSubmittedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    private function message(): string
    {
        $name = $this->data['student_name'] ?? 'A student';
        $term = $this->data['term'] ?? 'this term';

        return "{$name} submitted their end-of-term report for {$term}. Accept it and mark whether they are eligible for renewal.";
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject('End-of-Term Report Submitted')
            ->greeting("Dear {$notifiable->name},")
            ->line($this->message())
            ->action('Review the Report', \App\Support\Frontend::url('/supervisor/students'));
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'End-of-Term Report Submitted',
            'message' => $this->message(),
            'type' => 'term_report',
            'assignment_id' => $this->data['assignment_id'] ?? null,
            'student_id' => $this->data['student_id'] ?? null,
        ];
    }
}
