<?php

namespace App\Notifications;

use App\Models\Concern;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The DSA replied to (or resolved) the student's concern. */
class ConcernRepliedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly Concern $concern) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject('The DSA replied to your concern')
            ->greeting("Dear {$notifiable->name},")
            ->line("Your concern: {$this->concern->subject}")
            ->line('Reply from the DSA Office:')
            ->line($this->concern->response ?? '')
            ->action('View on the Help page', \App\Support\Frontend::url('/help'));
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->concern->status === Concern::STATUS_RESOLVED ? 'Concern resolved' : 'Reply to your concern',
            'message' => "The DSA Office replied to \"{$this->concern->subject}\".",
            'type' => 'concern',
            'concern_id' => $this->concern->id,
        ];
    }
}
