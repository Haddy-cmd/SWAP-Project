<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class StipendReleasedNotification extends Notification implements ShouldQueue
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

        return (new MailMessage())
            ->subject('SWAP Stipend Received')
            ->greeting("Dear {$notifiable->name},")
            ->line("Your SWAP stipend of ₱{$amount} for {$period} has been released and received.")
            ->line('Your Receiving Slip is available for your records.')
            ->action('View Stipend History', \App\Support\Frontend::url('/recipient/stipend'))
            ->line('Thank you for your dedicated service.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Stipend Received',
            'message' => "Your stipend of ₱" . number_format((float) ($this->data['amount'] ?? 0), 2) . " has been released and received.",
            'type' => 'stipend',
            'stipend_id' => $this->data['stipend_id'] ?? null,
        ];
    }
}
