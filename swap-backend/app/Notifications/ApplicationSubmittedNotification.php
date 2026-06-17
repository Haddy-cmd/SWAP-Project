<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class ApplicationSubmittedNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $applicant = $this->data['applicant_name'] ?? 'An applicant';

        return [
            'title' => 'New Application Submitted',
            'message' => "{$applicant} submitted a new SWAP application for review.",
            'type' => 'application',
            'application_id' => $this->data['application_id'] ?? null,
        ];
    }
}
