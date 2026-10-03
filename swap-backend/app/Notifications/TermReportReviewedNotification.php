<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The supervisor accepted the student's end-of-term report, marking them eligible or not for renewal. */
class TermReportReviewedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    private function message(): string
    {
        $term = $this->data['term'] ?? 'this term';

        return ($this->data['renewal_eligible'] ?? false)
            ? "Your supervisor accepted your end-of-term report for {$term} and marked you eligible for renewal."
            : "Your supervisor accepted your end-of-term report for {$term} and marked you not eligible for renewal.";
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage())
            ->subject('End-of-Term Report Accepted')
            ->greeting("Dear {$notifiable->name},")
            ->line($this->message());

        if (!empty($this->data['review_remarks'])) {
            $mail->line("Supervisor's remarks: {$this->data['review_remarks']}");
        }

        return $mail->action('View My Report', \App\Support\Frontend::url('/recipient/hours'));
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'End-of-Term Report Accepted',
            'message' => $this->message(),
            'type' => 'term_report',
            'assignment_id' => $this->data['assignment_id'] ?? null,
        ];
    }
}
