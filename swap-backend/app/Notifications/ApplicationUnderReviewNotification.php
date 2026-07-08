<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Tells an applicant their submission is now being reviewed by the DSA office.
 * In-app only — no email (verified/approved/rejected are the email-worthy steps).
 */
class ApplicationUnderReviewNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Application Under Review',
            'message' => 'Good news — the DSA office is now reviewing your SWAP application.',
            'type' => 'application',
            'application_id' => $this->data['application_id'] ?? null,
        ];
    }
}
