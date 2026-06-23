<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Sent to a supervisor when an admin requests an hours change (bonus hours or a
 * required-hours adjustment) that needs the supervisor's approval.
 */
class AdminHoursRequestNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->data['title'] ?? 'Approval needed',
            'message' => $this->data['message'] ?? '',
            'type' => $this->data['type'] ?? 'approval',
            'log_id' => $this->data['log_id'] ?? null,
            'assignment_id' => $this->data['assignment_id'] ?? null,
            'student_id' => $this->data['student_id'] ?? null,
        ];
    }
}
