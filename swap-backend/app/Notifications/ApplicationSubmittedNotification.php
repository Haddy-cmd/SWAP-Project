<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/** Admins: a new application or a renewal came in (with a "Resubmitted" / "Submitted twice" tag when it repeats). */
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
        $renewal = ($this->data['kind'] ?? 'new') === 'renewal';
        $term = $this->data['term'] ?? null;

        return [
            'title' => $renewal ? 'Renewal Submitted' : 'New Application Submitted',
            'message' => $renewal
                ? "{$applicant} requested renewal" . ($term ? " for {$term}" : '') . '.'
                : "{$applicant} submitted a SWAP application.",
            'type' => 'application',
            'application_id' => $this->data['application_id'] ?? null,
            'applicant_name' => $this->data['applicant_name'] ?? null,
            'kind' => $renewal ? 'renewal' : 'new',
            'term' => $term,
            'note' => $this->data['note'] ?? null,
        ];
    }
}
