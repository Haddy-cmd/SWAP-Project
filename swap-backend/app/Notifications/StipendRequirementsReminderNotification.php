<?php

namespace App\Notifications;

use App\Services\StipendReminderService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The DSA reminds a recipient what's missing before their stipend can be released. */
class StipendRequirementsReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly array $data) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    /** @return list<string> */
    private function missing(): array
    {
        return $this->data['missing'] ?? [];
    }

    private function message(): string
    {
        $steps = implode(' and ', array_map(fn ($m) => lcfirst($m), $this->missing()));

        return "Your stipend for {$this->data['term']} is ready to be released once you {$steps}.";
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage())
            ->subject('Finish These Steps to Receive Your Stipend')
            ->greeting("Dear {$notifiable->name},")
            ->line($this->message());
        foreach ($this->missing() as $step) {
            $mail->line("• {$step}.");
        }
        $signatureFirst = in_array(StipendReminderService::SIGNATURE, $this->missing(), true);

        return $mail->action($signatureFirst ? 'Open My Profile' : 'Open My Hours',
            \App\Support\Frontend::url($signatureFirst ? '/profile' : '/recipient/attendance#report'));
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Finish these steps to receive your stipend',
            'message' => $this->message(),
            'type' => 'stipend',
        ];
    }
}
