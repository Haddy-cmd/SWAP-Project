<?php

namespace App\Notifications;

use App\Models\OneTimeCode;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A 6-digit code by email (through the configured mailer, e.g. Brevo). Sent right away, never queued. */
class OneTimeCodeNotification extends Notification
{
    public function __construct(public readonly string $code, public readonly string $purpose, private readonly int $minutes) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        [$subject, $intro, $outro] = match ($this->purpose) {
            OneTimeCode::LOGIN => ['Your SWAP sign-in code', 'Use this code to finish signing in to the SWAP Portal:',
                "If you didn't just try to sign in, change your password right away."],
            OneTimeCode::PASSWORD_RESET => ['Your SWAP password reset code', 'Use this code to set a new password for the SWAP Portal:',
                "If you didn't ask to reset your password, you can ignore this email; your password stays the same."],
            default => ['Your SWAP verification code', 'Use this code to verify your email address for the SWAP Portal:',
                "If you didn't create a SWAP account, you can ignore this email."],
        };
        $spaced = substr($this->code, 0, 3) . ' ' . substr($this->code, 3);

        return (new MailMessage())
            ->subject($subject)
            ->greeting("Hello {$notifiable->name},")
            ->line($intro)
            ->line(new \Illuminate\Support\HtmlString(
                '<p style="font-size:30px;font-weight:700;letter-spacing:6px;text-align:center;margin:18px 0;color:#0B5234;">' . e($spaced) . '</p>'))
            ->line("The code expires in {$this->minutes} minutes. Never share it with anyone, the DSA will never ask for it.")
            ->line($outro);
    }
}
