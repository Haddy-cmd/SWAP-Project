<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\ApplicationApprovedNotification;
use Illuminate\Mail\Markdown;
use Tests\TestCase;

class EmailBrandingTest extends TestCase
{
    public function test_notification_email_is_swap_branded(): void
    {
        config(['swap.frontend_url' => 'https://swap-project-nqqw.vercel.app']);

        $user = new User(['name' => 'Norhadi Norodin']);
        $mail = (new ApplicationApprovedNotification(['application_id' => 1]))->toMail($user);
        $html = (string) app(Markdown::class)->render('notifications::email', $mail->data());

        $this->assertStringContainsString('SWAP Portal', $html);
        $this->assertStringContainsString('#7C1B26', $html);                         // maroon button/link
        $this->assertStringContainsString('dsa-logo.png', $html);                    // DSA seal
        $this->assertStringContainsString('Division of Student Affairs', $html);     // footer signature
        $this->assertStringNotContainsString('laravel.com/img', $html);              // no Laravel logo
        $this->assertDoesNotMatchRegularExpression('/Regards,\s*Laravel/i', $html);  // no Laravel salutation
    }
}
