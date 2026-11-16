<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The DSA reopened a rejected application (a rejection made by mistake) for another review. */
class ApplicationReopenedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    private function term(): string
    {
        return $this->data['term'] ?? 'this semester';
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject('SWAP Application Reopened')
            ->greeting("Dear {$notifiable->name},")
            ->line("The DSA Office has reopened your SWAP application for {$this->term()}. The earlier decision has been withdrawn and your application is being reviewed again.")
            ->line('You do not need to do anything for now. You will be notified of the result.')
            ->action('View Application', \App\Support\Frontend::url('/applicant/dashboard'));
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Application Reopened',
            'message' => "The DSA Office reopened your application for {$this->term()}. It is being reviewed again.",
            'type' => 'application',
            'application_id' => $this->data['application_id'] ?? null,
        ];
    }
}
