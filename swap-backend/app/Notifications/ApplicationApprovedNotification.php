<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ApplicationApprovedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject('SWAP Application Approved')
            ->greeting("Dear {$notifiable->name},")
            ->line('Congratulations! Your Student Welfare Assistantship Program application has been approved.')
            ->line('You will be assigned to an office shortly. Please check the SWAP Portal for your assignment details.')
            ->action('View Portal', \App\Support\Frontend::url('/applicant'))
            ->line('Thank you for being part of the SWAP program at MSU Marawi.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Application Approved',
            'message' => 'Congratulations! Your SWAP application has been approved.',
            'type' => 'application',
            'application_id' => $this->data['application_id'] ?? null,
        ];
    }
}
