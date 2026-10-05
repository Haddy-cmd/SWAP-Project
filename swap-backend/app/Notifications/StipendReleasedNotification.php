<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The DSA released the student's stipend (final; the stub carries their signature). */
class StipendReleasedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    private function message(): string
    {
        $amount = number_format((float) ($this->data['amount'] ?? 0), 2);
        $period = $this->data['period_label'] ?? $this->data['term'] ?? 'this period';

        return "Your SWAP stipend of ₱{$amount} for {$period} has been released.";
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage())
            ->subject('SWAP Stipend Released')
            ->greeting("Dear {$notifiable->name},")
            ->line($this->message());

        if (!empty($this->data['control_number'])) {
            $mail->line("Control Number: {$this->data['control_number']}");
        }

        return $mail
            ->line('Your stub, signed with your saved signature, is on your Stipend page for your records.')
            ->action('View My Stipend', \App\Support\Frontend::url('/recipient/stipend'))
            ->line('Thank you for your dedicated service.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Stipend Released',
            'message' => $this->message(),
            'type' => 'stipend',
            'stipend_id' => $this->data['stipend_id'] ?? null,
        ];
    }
}
