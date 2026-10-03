<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PromissoryReviewedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $approved = ($this->data['decision'] ?? '') === 'approved';

        $mail = (new MailMessage())
            ->subject($approved ? 'Promissory Note Approved' : 'Promissory Note Rejected')
            ->greeting("Dear {$notifiable->name},");

        if ($approved) {
            $lacking = rtrim(rtrim(number_format((float) ($this->data['lacking_hours'] ?? 0), 2, '.', ''), '0'), '.');
            $mail->line("Your promissory note was approved, covering {$lacking} lacking hour(s).")
                ->line("If you renew, these {$lacking} hours are added to your next semester's required hours.")
                ->action('View My Stipend', \App\Support\Frontend::url('/recipient/stipend'));
        } else {
            $mail->line('Your promissory note was not approved.')
                ->line('Supervisor remarks: '.($this->data['review_remarks'] ?? '—').'.');
        }

        return $mail;
    }

    public function toArray(object $notifiable): array
    {
        $approved = ($this->data['decision'] ?? '') === 'approved';

        return [
            'title' => $approved ? 'Promissory Note Approved' : 'Promissory Note Rejected',
            'message' => $approved
                ? 'Your promissory note was approved. If you renew, the lacking hours are added to your next semester\'s required hours.'
                : 'Your promissory note was not approved.',
            'type' => 'promissory',
            'promissory_id' => $this->data['promissory_id'] ?? null,
        ];
    }
}
