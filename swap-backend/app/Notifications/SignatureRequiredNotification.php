<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SignatureRequiredNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject('Action needed: save your digital signature')
            ->greeting("Dear {$notifiable->name},")
            ->line('Your account has no digital signature on file.')
            ->line('Your stipend cannot be released until you save one: it signs your claim stub and your receipt.')
            ->action('Open My Profile', \App\Support\Frontend::url('/profile'))
            ->line('Draw or upload your signature — it takes less than a minute.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Digital signature required',
            'message' => 'Your stipend cannot be released until you save your digital signature on your Profile page.',
            'type' => 'signature',
        ];
    }
}
