<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A new application or a renewal was not approved (data `type`: new | renewal). */
class ApplicationRejectedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public const MSG_BACK_TO_APPLICANT = 'Your account is now an applicant account. You can apply again as a new applicant while the application period is open.';

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
        $remarks = $this->data['remarks'] ?? 'No additional remarks provided.';

        if ($this->isRenewal()) {
            return (new MailMessage())
                ->subject('SWAP Renewal Update')
                ->greeting("Dear {$notifiable->name},")
                ->line("We regret to inform you that your SWAP renewal for {$this->term()} has not been approved at this time.")
                ->line("Remarks: {$remarks}")
                ->line(self::MSG_BACK_TO_APPLICANT)
                ->line('If you have questions, please contact the DSA Office.')
                ->action('Go to My Portal', \App\Support\Frontend::url('/applicant/dashboard'))
                ->line('Thank you for your service in the SWAP program.');
        }

        return (new MailMessage())
            ->subject('SWAP Application Update')
            ->greeting("Dear {$notifiable->name},")
            ->line('We regret to inform you that your SWAP application has not been approved at this time.')
            ->line("Remarks: {$remarks}")
            ->line('You may re-apply for the next semester. If you have questions, please contact the DSA Office.')
            ->action('View Application', \App\Support\Frontend::url('/applicant/dashboard'))
            ->line('Thank you for your interest in the SWAP program.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->isRenewal() ? 'Renewal Not Approved' : 'Application Not Approved',
            'message' => $this->isRenewal()
                ? "Your SWAP renewal for {$this->term()} was not approved. " . self::MSG_BACK_TO_APPLICANT
                : 'Your SWAP application has been reviewed. Please check your application for details.',
            'type' => 'application',
            'application_id' => $this->data['application_id'] ?? null,
        ];
    }
}
