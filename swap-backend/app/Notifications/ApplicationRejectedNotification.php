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

    public const MSG_BACK_TO_APPLICANT = 'Your account is now an applicant account. You can apply again as a new applicant next semester, once the DSA opens applications.';

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
        $remarks = $this->data['remarks'] ?? null;
        $reason = $this->data['reason'] ?? null;

        if ($this->isRenewal()) {
            $mail = (new MailMessage())
                ->subject('SWAP Renewal Update')
                ->greeting("Dear {$notifiable->name},")
                ->line("We regret to inform you that your SWAP renewal for {$this->term()} has not been approved at this time.")
                ->line('Reason: ' . ($reason ?? $remarks ?? 'No reason given.'))
                ->lineIf($reason !== null && $remarks !== null, "Note from the DSA: {$remarks}")
                ->line(self::MSG_BACK_TO_APPLICANT);
            // Their Stipend page is closed to an applicant account: the stub comes with this email.
            if (\App\Support\ClaimStubAttachment::attach($mail, $this->data['stipend_id'] ?? null)) {
                $mail->line('Your claim stub for your last stipend is attached to this email. Keep it for your records.');
            }

            return $mail
                ->action('Go to My Dashboard', \App\Support\Frontend::url('/applicant/dashboard'))
                ->line('If you have questions, please visit the DSA Office.')
                ->line('Thank you for your service in the SWAP program.');
        }

        return (new MailMessage())
            ->subject('SWAP Application Update')
            ->greeting("Dear {$notifiable->name},")
            ->line("We regret to inform you that your SWAP application for {$this->term()} has not been approved.")
            ->line('Reason: ' . ($reason ?? $remarks ?? 'No reason given.'))
            ->lineIf($reason !== null && $remarks !== null, "Note from the DSA: {$remarks}")
            ->line('You can apply again next semester, once the DSA opens applications. Your uploaded documents for this application are removed when the next semester starts, so keep your own copies.')
            ->line('If you have questions, please visit the DSA Office.')
            ->action('View Application', \App\Support\Frontend::url('/applicant/dashboard'))
            ->line('Thank you for your interest in the SWAP program.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->isRenewal() ? 'Renewal Not Approved' : 'Application Not Approved',
            'message' => $this->isRenewal()
                ? "Your SWAP renewal for {$this->term()} was not approved. " . self::MSG_BACK_TO_APPLICANT
                : "Your SWAP application for {$this->term()} was not approved" . (($this->data['reason'] ?? null) ? " ({$this->data['reason']})" : '') . '. You can apply again next semester.',
            'type' => 'application',
            'application_id' => $this->data['application_id'] ?? null,
        ];
    }
}
