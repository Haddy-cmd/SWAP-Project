<?php

namespace App\Listeners;

use App\Events\HoursRejected;
use App\Jobs\SendApplicationNotificationJob;

class SendHoursRejectedNotification
{
    public function handle(HoursRejected $event): void
    {
        SendApplicationNotificationJob::dispatch('hours_rejected', [
            'user_id' => $event->timeLog->user_id,
            'log_id' => $event->timeLog->id,
            'feedback' => $event->feedback,
        ])->onQueue('notifications');
    }
}
