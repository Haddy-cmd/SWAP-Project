<?php

namespace App\Listeners;

use App\Events\HoursVerified;
use App\Jobs\SendApplicationNotificationJob;

class SendHoursVerifiedNotification
{
    public function handle(HoursVerified $event): void
    {
        SendApplicationNotificationJob::dispatch('hours_verified', [
            'user_id' => $event->timeLog->user_id,
            'log_id' => $event->timeLog->id,
            'duration_hours' => $event->timeLog->duration_hours,
        ])->onQueue('notifications');
    }
}
