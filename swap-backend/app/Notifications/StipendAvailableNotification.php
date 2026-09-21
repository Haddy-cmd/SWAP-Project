<?php

namespace App\Notifications;

use App\Support\Frontend;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Fired when the DSA certifies a stipend (status → certified). This is the
 * "allowance is available to claim" message — distinct from
 * StipendReleasedNotification, which now fires only once the money is received.
 */
class StipendAvailableNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $amount = number_format((float) ($this->data['amount'] ?? 0), 2);
        $period = $this->data['period_label'] ?? 'this period';
        $control = $this->data['control_number'] ?? '';

        return (new MailMessage())
            ->subject('Your SWAP Stipend Is Ready to Claim')
            ->greeting("Dear {$notifiable->name},")
            ->line("Your SWAP allowance of ₱{$amount} for {$period} has been approved and is now available for release.")
            ->line("Control Number: {$control}")
            ->line('Present your digital claim slip at the University Banking Office to claim it.')
            ->action('View / Download Claim Slip', Frontend::url('/recipient/stipend/' . ($this->data['stipend_id'] ?? '')))
            ->line('Thank you for your dedicated service.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Stipend Ready to Claim',
            'message' => 'Your stipend of ₱' . number_format((float) ($this->data['amount'] ?? 0), 2)
                . ' is available for release. Present your claim slip at the Banking Office.',
            'type' => 'stipend',
            'stipend_id' => $this->data['stipend_id'] ?? null,
        ];
    }
}
