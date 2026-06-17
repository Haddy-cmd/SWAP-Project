<?php

namespace App\Jobs;

use App\Models\User;
use App\Notifications\ApplicationApprovedNotification;
use App\Notifications\ApplicationRejectedNotification;
use App\Notifications\ApplicationSubmittedNotification;
use App\Notifications\HoursPendingVerificationNotification;
use App\Notifications\HoursRejectedNotification;
use App\Notifications\HoursVerifiedNotification;
use App\Notifications\InterviewScheduledNotification;
use App\Notifications\StipendReleasedNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendApplicationNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 60;

    public function __construct(
        private readonly string $type,
        private readonly array $data
    ) {}

    public function handle(): void
    {
        $user = User::find($this->data['user_id'] ?? null);

        if (!$user) {
            return;
        }

        $notification = match ($this->type) {
            'application_submitted' => new ApplicationSubmittedNotification($this->data),
            'application_approved' => new ApplicationApprovedNotification($this->data),
            'application_rejected' => new ApplicationRejectedNotification($this->data),
            'interview_scheduled' => new InterviewScheduledNotification($this->data),
            'hours_verified' => new HoursVerifiedNotification($this->data),
            'hours_rejected' => new HoursRejectedNotification($this->data),
            'supervisor_time_out' => new HoursPendingVerificationNotification($this->data),
            'stipend_released' => new StipendReleasedNotification($this->data),
            default => null,
        };

        if ($notification) {
            $user->notify($notification);
        }
    }
}
