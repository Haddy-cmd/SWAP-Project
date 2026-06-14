<?php

namespace App\Listeners;

use App\Events\StipendReleased;
use App\Jobs\SendApplicationNotificationJob;

class SendStipendReleasedNotification
{
    public function handle(StipendReleased $event): void
    {
        SendApplicationNotificationJob::dispatch('stipend_released', [
            'user_id' => $event->stipend->user_id,
            'stipend_id' => $event->stipend->id,
            'amount' => $event->stipend->amount,
        ])->onQueue('notifications');
    }
}
