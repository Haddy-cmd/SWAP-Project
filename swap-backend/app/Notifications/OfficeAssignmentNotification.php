<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Tells a recipient where they've been placed: sent when an assignment is first
 * created, and again (with changed=true) when the admin moves them to a
 * different office or supervisor.
 */
class OfficeAssignmentNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $office = $this->data['office'] ?? 'your assigned office';
        $supervisor = $this->data['supervisor'] ?? 'your supervisor';
        $changed = (bool) ($this->data['changed'] ?? false);

        $mail = (new MailMessage())
            ->subject($changed ? 'Your SWAP Office Assignment Has Changed' : 'Your SWAP Office Assignment')
            ->greeting("Dear {$notifiable->name},")
            ->line($changed
                ? "Your SWAP assignment has been updated. You are now assigned to {$office}."
                : "Congratulations! You have been assigned to {$office}.")
            ->line("Your immediate supervisor is {$supervisor}.");

        if (!empty($this->data['location'])) {
            $mail->line("Office location: {$this->data['location']}.");
        }

        return $mail
            ->line($changed
                ? 'From now on, clock in using the QR code posted at your new office.'
                : 'Report to your office to begin rendering your service hours — clock in by scanning the QR code posted there.')
            ->action('Open Your Dashboard', $this->frontendUrl('/recipient/dashboard'))
            ->line('Thank you for being part of the Student Welfare Assistance Program.');
    }

    public function toArray(object $notifiable): array
    {
        $office = $this->data['office'] ?? 'your assigned office';
        $supervisor = $this->data['supervisor'] ?? 'your supervisor';
        $changed = (bool) ($this->data['changed'] ?? false);

        return [
            'title' => $changed ? 'Office Assignment Updated' : 'Assigned to an Office',
            'message' => $changed
                ? "You have been moved to {$office}. Your supervisor is now {$supervisor}."
                : "You have been assigned to {$office} under {$supervisor}.",
            'type' => 'assignment',
            'assignment_id' => $this->data['assignment_id'] ?? null,
        ];
    }

    private function frontendUrl(string $path): string
    {
        $base = trim((string) config('swap.frontend_url'));
        if ($base === '') {
            $base = 'http://localhost:3000';
        }
        if (!str_contains($base, '://')) {
            $base = 'https://' . $base;
        }

        return rtrim($base, '/') . $path;
    }
}
