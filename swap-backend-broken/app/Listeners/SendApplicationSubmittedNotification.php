<?php

namespace App\Listeners;

use App\Events\ApplicationSubmitted;
use App\Jobs\SendApplicationNotificationJob;
use App\Models\User;

class SendApplicationSubmittedNotification
{
    public function handle(ApplicationSubmitted $event): void
    {
        $admins = User::where('role', 'admin')->where('is_active', true)->get();

        foreach ($admins as $admin) {
            SendApplicationNotificationJob::dispatch('application_submitted', [
                'user_id' => $admin->id,
                'application_id' => $event->application->id,
                'applicant_name' => $event->application->user->name,
            ])->onQueue('notifications');
        }
    }
}
