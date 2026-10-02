<?php

namespace App\Listeners;

use App\Events\ApplicationApproved;
use App\Jobs\SendApplicationNotificationJob;
use App\Models\Assignment;

class SendApplicationApprovedNotification
{
    public function handle(ApplicationApproved $event): void
    {
        $application = $event->application;
        $data = [
            'user_id' => $application->user_id,
            'application_id' => $application->id,
            'type' => $application->type ?? 'new',
            'term' => "{$application->semester} {$application->academic_year}",
        ];

        // A renewal is approved together with the new term's placement: say where and how many hours.
        if ($data['type'] === 'renewal') {
            $next = Assignment::with('office')->where('user_id', $application->user_id)
                ->where('academic_year', $application->academic_year)->where('semester', $application->semester)
                ->latest('id')->first();
            $data += [
                'office' => $next?->office?->name,
                'required_hours' => $next ? (int) $next->required_hours : null,
                'carried_hours' => $next ? (int) ($next->carried_over_hours ?? 0) : 0,
            ];
        }

        SendApplicationNotificationJob::dispatch('application_approved', $data)->onQueue('notifications');
    }
}
