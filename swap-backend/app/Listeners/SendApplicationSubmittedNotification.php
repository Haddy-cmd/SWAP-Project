<?php

namespace App\Listeners;

use App\Events\ApplicationSubmitted;
use App\Jobs\SendApplicationNotificationJob;
use App\Models\Application;
use App\Models\User;

class SendApplicationSubmittedNotification
{
    public function handle(ApplicationSubmitted $event): void
    {
        $application = $event->application;
        $admins = User::where('role', 'admin')->where('is_active', true)->get();

        $others = Application::where('user_id', $application->user_id)->whereKeyNot($application->id);
        // The admin's notification flags a repeat: another one for the same term, or a fresh try after a rejection.
        $note = (clone $others)->where('academic_year', $application->academic_year)->where('semester', $application->semester)->exists()
            ? 'Submitted twice'
            : ((clone $others)->where('status', 'rejected')->exists() ? 'Resubmitted' : null);

        foreach ($admins as $admin) {
            SendApplicationNotificationJob::dispatch('application_submitted', [
                'user_id' => $admin->id,
                'application_id' => $application->id,
                'applicant_name' => $application->user->name,
                'kind' => ($application->type ?? 'new') === 'renewal' ? 'renewal' : 'new',
                'term' => trim("{$application->semester} {$application->academic_year}"),
                'note' => $note,
            ])->onQueue('notifications');
        }
    }
}
