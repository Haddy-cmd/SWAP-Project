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
        ])->onQueue('notifications');
    }
}
