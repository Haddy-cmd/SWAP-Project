<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ApplicationRejectedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $remarks = $this->data['remarks'] ?? 'No additional remarks provided.';

        return (new MailMessage())
            ->subject('SWAP Application Update')
            ->greeting("Dear {$notifiable->name},")
            ->line('We regret to inform you that your SWAP application has not been approved at this time.')
            ->line("Remarks: {$remarks}")
            ->line('You may re-apply for the next semester. If you have questions, please contact the DSA Office.')
            ->action('View Application', config('app.frontend_url') . '/applicant')
            ->line('Thank you for your interest in the SWAP program.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Application Not Approved',
            'message' => 'Your SWAP application has been reviewed. Please check your application for details.',
            'type' => 'application',
            'application_id' => $this->data['application_id'] ?? null,
        ];
    }
}
