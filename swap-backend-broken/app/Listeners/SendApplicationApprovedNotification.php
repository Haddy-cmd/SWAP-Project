<?php

namespace App\Listeners;

use App\Events\ApplicationApproved;
use App\Jobs\SendApplicationNotificationJob;

class SendApplicationApprovedNotification
{
    public function handle(ApplicationApproved $event): void
    {
        SendApplicationNotificationJob::dispatch('application_approved', [
            'user_id' => $event->application->user_id,
            'application_id' => $event->application->id,
        ])->onQueue('notifications');
    }
}
