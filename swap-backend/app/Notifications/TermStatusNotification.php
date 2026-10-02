<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A term's verdict changed (TermStatusService): deficient, or qualified after the makeup. */
class TermStatusNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    private function title(): string
    {
        return ($this->data['kind'] ?? '') === 'qualified' ? 'Semester service: Qualified' : 'Semester service: Deficient';
    }

    private function message(): string
    {
        $term = $this->data['term'] ?? 'this semester';
        $hours = rtrim(rtrim(number_format((float) ($this->data['deficient_hours'] ?? 0), 2), '0'), '.');

        if (($this->data['kind'] ?? '') === 'qualified') {
            return "You have completed the required hours for {$term}. Your term is now Qualified.";
        }

        if (!empty($this->data['by_supervisor'])) {
            return "Your supervisor marked your {$term} service as deficient ({$hours} hours short). Reason: "
                .($this->data['reason'] ?? '—');
        }

        return "You were {$hours} hours short for {$term}. Submit a promissory note on the Stipend page.";
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject($this->title())
            ->greeting("Dear {$notifiable->name},")
            ->line($this->message())
            ->action('View My Stipend', \App\Support\Frontend::url('/recipient/stipend'));
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->title(),
            'message' => $this->message(),
            'type' => 'term',
            'assignment_id' => $this->data['assignment_id'] ?? null,
        ];
    }
}
