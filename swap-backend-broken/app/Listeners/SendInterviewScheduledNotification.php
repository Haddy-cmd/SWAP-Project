<?php

namespace App\Listeners;

use App\Events\InterviewScheduled;
use App\Jobs\SendApplicationNotificationJob;

class SendInterviewScheduledNotification
{
    public function handle(InterviewScheduled $event): void
    {
        SendApplicationNotificationJob::dispatch('interview_scheduled', [
            'user_id' => $event->application->user_id,
            'application_id' => $event->application->id,
            'interview_id' => $event->application->interview?->id,
        ])->onQueue('notifications');
    }
}
