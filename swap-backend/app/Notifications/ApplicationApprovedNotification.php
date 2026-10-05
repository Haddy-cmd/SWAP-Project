<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A new application or a renewal was approved (data `type`: new | renewal). */
class ApplicationApprovedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    private function isRenewal(): bool
    {
        return ($this->data['type'] ?? 'new') === 'renewal';
    }

    private function term(): string
    {
        return $this->data['term'] ?? 'the next term';
    }

    public function toMail(object $notifiable): MailMessage
    {
        if ($this->isRenewal()) {
            $mail = (new MailMessage())
                ->subject('SWAP Renewal Approved')
                ->greeting("Dear {$notifiable->name},")
                ->line("Your SWAP renewal for {$this->term()} has been approved.");

            if (!empty($this->data['office'])) {
                $mail->line("You continue in {$this->data['office']} for {$this->term()}.");
            }
            if (!empty($this->data['required_hours'])) {
                $carried = (int) ($this->data['carried_hours'] ?? 0);
                $mail->line("Required hours for the term: {$this->data['required_hours']}"
                    . ($carried > 0 ? " (including {$carried} lacking hours carried over from last term)." : '.'));
            }

            return $mail
                ->action('View My Renewal', \App\Support\Frontend::url('/recipient/renewal'))
                ->line('Thank you for continuing with the SWAP program at MSU Marawi.');
        }

        return (new MailMessage())
            ->subject('SWAP Application Approved')
            ->greeting("Dear {$notifiable->name},")
            ->line('Congratulations! Your Student Welfare Assistantship Program application has been approved.')
            ->line('You are now a SWAP recipient: announcements from the DSA reach you in the portal and by email.')
            ->line('You will be assigned to an office shortly. Please check the SWAP Portal for your assignment details.')
            ->action('View Portal', \App\Support\Frontend::url('/recipient/dashboard'))
            ->line('Thank you for being part of the SWAP program at MSU Marawi.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->isRenewal() ? 'Renewal Approved' : 'Application Approved',
            'message' => $this->isRenewal()
                ? "Your SWAP renewal for {$this->term()} has been approved."
                : 'Congratulations! Your SWAP application has been approved. You are now a SWAP recipient; the DSA will assign your office soon.',
            'type' => 'application',
            'application_id' => $this->data['application_id'] ?? null,
        ];
    }
}
