<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class HoursPendingVerificationNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $student = $this->data['student_name'] ?? 'A recipient';
        $hours = $this->data['duration_hours'] ?? 0;

        return [
            'title' => 'Attendance Needs Verification',
            'message' => "{$student} clocked out ({$hours} hrs) and is awaiting your verification.",
            'type' => 'verification',
            'log_id' => $this->data['log_id'] ?? null,
        ];
    }
}
