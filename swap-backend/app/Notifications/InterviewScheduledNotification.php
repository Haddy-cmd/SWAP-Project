<?php

namespace App\Notifications;

use App\Models\Interview;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class InterviewScheduledNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $interview = isset($this->data['interview_id'])
            ? Interview::find($this->data['interview_id'])
            : null;

        $mail = (new MailMessage())
            ->subject('SWAP Interview Scheduled')
            ->greeting("Dear {$notifiable->name},")
            ->line('Your SWAP application interview has been scheduled.');

        if ($interview) {
            $mail->line("Date & Time: {$interview->scheduled_at->timezone('Asia/Manila')->format('F j, Y g:i A')}")
                ->line("Location: {$interview->location}")
                ->line("Mode: " . ucfirst(str_replace('_', ' ', $interview->mode)));
        }

        return $mail
            ->action('View Details', \App\Support\Frontend::url('/applicant'))
            ->line('Please be punctual and bring the required documents.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Interview Scheduled',
            'message' => 'Your SWAP application interview has been scheduled. Please check the portal for details.',
            'type' => 'interview',
            'application_id' => $this->data['application_id'] ?? null,
        ];
    }
}
