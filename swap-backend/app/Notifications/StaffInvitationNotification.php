<?php

namespace App\Notifications;

use App\Models\StaffInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Emailed to a prospective supervisor/admin. Sent via on-demand routing —
 * the recipient has no account yet, so there is no database channel here.
 */
class StaffInvitationNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly StaffInvitation $invitation,
        private readonly string $plainToken,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $role = ucfirst($this->invitation->role);
        $inviter = $this->invitation->inviter?->name ?? 'The DSA Office';
        $greetingName = $this->invitation->name ?: 'there';

        $mail = (new MailMessage())
            ->subject("You're invited to the SWAP Portal as {$role}")
            ->greeting("Hello {$greetingName},")
            ->line("{$inviter} has invited you to join the SWAP Portal (MSU Marawi) as a {$role}.");

        if ($this->invitation->office) {
            $mail->line("You will be attached to: {$this->invitation->office->name}.");
        }

        return $mail
            ->line('Click the button below to set your password and activate your account.')
            ->action('Create Your Account', \App\Support\Frontend::url('/accept-invitation?token=' . $this->plainToken))
            ->line('This invitation expires in ' . StaffInvitation::EXPIRES_DAYS . ' days. If you were not expecting it, you can ignore this email.');
    }
}
