<?php

namespace App\Notifications;

use App\Services\TermReportReminderService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Submit the end-of-term narrative report: the required hours are met, or the term has ended. */
class TermReportDueNotification extends Notification implements ShouldQueue
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

        return ($this->data['kind'] ?? '') === TermReportReminderService::KIND_HOURS_MET
            ? "You've completed the {$this->data['required_hours']} required hours for {$term}. Submit your end-of-term narrative report on the Hours page — your stipend can't be released without it."
            : "{$term} has ended. Submit your end-of-term narrative report on the Hours page — your stipend and renewal need it.";
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject('Submit Your End-of-Term Report')
            ->greeting("Dear {$notifiable->name},")
            ->line($this->message())
            ->action('Write My Report', \App\Support\Frontend::url('/recipient/hours'));
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Submit Your End-of-Term Report',
            'message' => $this->message(),
            'type' => 'term_report',
            'assignment_id' => $this->data['assignment_id'] ?? null,
        ];
    }
}
