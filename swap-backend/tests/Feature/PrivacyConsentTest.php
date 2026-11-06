<?php

namespace Tests\Feature;

use App\Models\PendingRegistration;
use App\Models\Setting;
use App\Models\StaffInvitation;
use App\Models\User;
use App\Notifications\OneTimeCodeNotification;
use App\Support\PrivacyNotice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** New accounts must agree to the Privacy Notice; the time and version are kept on the account. */
class PrivacyConsentTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        Setting::put('applications_open', '1');
    }

    private function form(array $overrides = []): array
    {
        return array_merge([
            'email' => 'amina@s.msumain.edu.ph', 'password' => 'Password@123', 'password_confirmation' => 'Password@123',
            'student_id_number' => '202400111', 'first_name' => 'Amina', 'last_name' => 'Alonto',
            'college' => 'CICS', 'program' => 'BS Computer Science', 'year_level' => 2, 'privacy_consent' => true,
        ], $overrides);
    }

    private function invite(string $email): string
    {
        $plain = str_repeat('b', 63) . substr(md5($email), 0, 1);
        StaffInvitation::create([
            'email' => $email, 'role' => 'supervisor', 'token' => hash('sha256', $plain),
            'invited_by' => $this->makeUser('admin')->id, 'expires_at' => now()->addDays(3),
        ]);

        return $plain;
    }

    private function accept(string $token, array $overrides = [])
    {
        return $this->postJson("/api/invitations/{$token}/accept", array_merge([
            'name' => 'Maria Santos', 'employee_id' => '20190123',
            'password' => 'Secret123', 'password_confirmation' => 'Secret123', 'privacy_consent' => true,
        ], $overrides));
    }

    public function test_registration_is_refused_without_consent(): void
    {
        foreach ([[], ['privacy_consent' => false]] as $case) {
            $form = $this->form($case);
            if ($case === []) {
                unset($form['privacy_consent']);
            }
            $this->postJson('/api/auth/register', $form)->assertStatus(422)
                ->assertJsonPath('errors.privacy_consent.0', PrivacyNotice::MSG_REQUIRED);
        }

        $this->assertSame(0, PendingRegistration::count());
        Notification::assertNothingSent();
    }

    public function test_registration_records_when_and_which_notice_was_agreed_to(): void
    {
        $this->travelTo(now()->startOfSecond());
        $agreedAt = now();
        $this->postJson('/api/auth/register', $this->form())->assertStatus(202);

        $code = null;
        Notification::assertSentOnDemand(OneTimeCodeNotification::class, function ($n) use (&$code) {
            $code = $n->code;

            return true;
        });

        // Entering the code later doesn't move the consent time.
        $this->travel(5)->minutes();
        $this->postJson('/api/auth/register/verify', ['email' => 'amina@s.msumain.edu.ph', 'code' => $code])->assertCreated();

        $user = User::where('email', 'amina@s.msumain.edu.ph')->firstOrFail();
        $this->assertTrue($user->privacy_accepted_at->eq($agreedAt));
        $this->assertSame(PrivacyNotice::VERSION, $user->privacy_version);
    }

    public function test_staff_invitation_needs_consent_and_records_it(): void
    {
        $token = $this->invite('maria@msumain.edu.ph');

        $this->accept($token, ['privacy_consent' => false])->assertStatus(422)
            ->assertJsonPath('errors.privacy_consent.0', PrivacyNotice::MSG_REQUIRED);
        $this->assertDatabaseMissing('users', ['email' => 'maria@msumain.edu.ph']);

        $this->accept($token)->assertCreated();
        $user = User::where('email', 'maria@msumain.edu.ph')->firstOrFail();
        $this->assertNotNull($user->privacy_accepted_at);
        $this->assertSame(PrivacyNotice::VERSION, $user->privacy_version);
    }
}
