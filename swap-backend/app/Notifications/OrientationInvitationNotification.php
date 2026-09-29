<?php

namespace App\Notifications;

use App\Models\OrientationSession;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class OrientationInvitationNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly OrientationSession $session) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    private function when(): string
    {
        return $this->session->scheduled_at->timezone('Asia/Manila')->format('F j, Y g:i A');
    }

    public function toMail(object $notifiable): MailMessage
    {
        $online = $this->session->mode === 'online';

        $mail = (new MailMessage())
            ->subject('SWAP Orientation Schedule')
            ->greeting("Dear {$notifiable->name},")
            ->line('You are invited to the SWAP orientation. Attending it is required before you can be placed in an office.')
            ->line("Session: {$this->session->title}")
            ->line("Date & Time: {$this->when()}")
            ->line(($online ? 'Meeting Link' : 'Venue') . ': ' . ($this->session->venue() ?? 'To be announced'));

        if ($this->session->notes) {
            $mail->line($this->session->notes);
        }

        return $mail
            ->action('View in the SWAP Portal', \App\Support\Frontend::url('/applicant/dashboard'))
            ->line('Please be on time. If you cannot attend, contact the DSA Office.');
    }

    public function toArray(object $notifiable): array
    {
        $online = $this->session->mode === 'online';

        return [
            'title' => 'Orientation Scheduled',
            'message' => "You are invited to the SWAP orientation on {$this->when()} "
                . ($online ? '(online).' : 'at ' . ($this->session->location ?? 'the DSA Office') . '.')
                . ' Attendance is required before office placement.',
            'type' => 'orientation',
            'orientation_session_id' => $this->session->id,
        ];
    }
}
