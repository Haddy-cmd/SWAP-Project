<?php

namespace App\Listeners;

use App\Events\ApplicationRejected;
use App\Jobs\SendApplicationNotificationJob;

class SendApplicationRejectedNotification
{
    public function handle(ApplicationRejected $event): void
    {
        SendApplicationNotificationJob::dispatch('application_rejected', [
            'user_id' => $event->application->user_id,
            'application_id' => $event->application->id,
            'remarks' => $event->application->remarks,
            'reason' => \App\Support\RejectionReasons::label($event->application->rejection_reason),
            'type' => $event->application->type ?? 'new',
            'term' => "{$event->application->semester} {$event->application->academic_year}",
            // A rejected renewal: their last issued stub, attached to the email (Stipend page is closed to them).
            'stipend_id' => ($event->application->type ?? 'new') === 'renewal'
                ? \App\Support\ClaimStubAttachment::latestFor($event->application->user_id, $event->application->academic_year, $event->application->semester)?->id
                : null,
        ])->onQueue('notifications');
    }
}
