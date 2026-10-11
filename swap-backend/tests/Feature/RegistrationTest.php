<?php

namespace Tests\Feature;

use App\Models\PendingRegistration;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\OneTimeCodeNotification;
use App\Services\OneTimeCodeService;
use App\Services\RegistrationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Sign-up: the form is held until the emailed code is confirmed; then the account exists and is signed in. */
class RegistrationTest extends TestCase
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
            'college' => 'CICS', 'program' => 'BS Computer Science', 'year_level' => 2,
        ], $overrides);
    }

    /** Every code sent to this address, oldest first. */
    private function codes(string $email): array
    {
        $codes = [];
        Notification::assertSentOnDemand(OneTimeCodeNotification::class, function ($n, $c, $notifiable) use ($email, &$codes) {
            if (($notifiable->routes['mail'] ?? null) === $email) {
                $codes[] = $n->code;
            }

            return true;
        });

        return $codes;
    }

    private function wrong(string $code): string
    {
        return str_pad((string) (((int) $code + 1) % 1000000), 6, '0', STR_PAD_LEFT);
    }

    private function verify(string $code, string $email = 'amina@s.msumain.edu.ph')
    {
        return $this->postJson('/api/auth/register/verify', ['email' => $email, 'code' => $code]);
    }

    public function test_nothing_is_created_until_the_right_code_then_the_account_is_signed_in(): void
    {
        $this->postJson('/api/auth/register', $this->form())->assertStatus(202)
            ->assertJsonPath('message', RegistrationService::MSG_SENT);
        $this->assertSame(0, User::count());
        $code = $this->codes('amina@s.msumain.edu.ph')[0];
        $this->assertDatabaseMissing('pending_registrations', ['code_hash' => $code]);

        $this->verify($this->wrong($code))->assertStatus(422)->assertJsonPath('errors.code.0', OneTimeCodeService::MSG_WRONG);
        $this->assertSame(0, User::count());

        $res = $this->verify(substr($code, 0, 3) . ' ' . substr($code, 3))->assertCreated()
            ->assertJsonPath('message', 'Welcome to SWAP! Your account is ready.');
        $user = User::where('email', 'amina@s.msumain.edu.ph')->firstOrFail();
        $this->assertTrue($user->hasVerifiedEmail() && $user->is_active);
        $this->assertSame('202400111', $user->profile->student_id_number);
        // The password works for later sign-ins (stored hash kept as is).
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('Password@123', $user->password));
        $this->withToken($res->json('token'))->getJson('/api/profile')->assertOk();

        // Used up.
        $this->verify($code)->assertStatus(422)->assertJsonPath('errors.code.0', RegistrationService::MSG_GONE);
    }

    public function test_five_wrong_tries_lock_the_code_and_a_new_one_works(): void
    {
        $this->postJson('/api/auth/register', $this->form())->assertStatus(202);
        $code = $this->codes('amina@s.msumain.edu.ph')[0];

        for ($i = 0; $i < 4; $i++) {
            $this->verify($this->wrong($code))->assertJsonPath('errors.code.0', OneTimeCodeService::MSG_WRONG);
        }
        $this->verify($this->wrong($code))->assertJsonPath('errors.code.0', OneTimeCodeService::MSG_TOO_MANY);
        $this->verify($code)->assertJsonPath('errors.code.0', OneTimeCodeService::MSG_TOO_MANY);

        $this->postJson('/api/auth/register/resend', ['email' => 'amina@s.msumain.edu.ph'])->assertStatus(422)
            ->assertJsonPath('errors.code.0', OneTimeCodeService::MSG_WAIT);
        $this->travel(61)->seconds();
        $this->postJson('/api/auth/register/resend', ['email' => 'amina@s.msumain.edu.ph'])->assertOk();
        $fresh = array_values(array_slice($this->codes('amina@s.msumain.edu.ph'), -1))[0];
        $this->verify($fresh)->assertCreated();
    }

    public function test_codes_and_the_hold_expire(): void
    {
        $this->postJson('/api/auth/register', $this->form())->assertStatus(202);
        $code = $this->codes('amina@s.msumain.edu.ph')[0];

        $this->travel(11)->minutes();
        $this->verify($code)->assertJsonPath('errors.code.0', OneTimeCodeService::MSG_EXPIRED);

        $this->travel(20)->minutes(); // 31 minutes in: the whole sign-up is gone
        $this->verify($code)->assertJsonPath('errors.code.0', RegistrationService::MSG_GONE);
        $this->postJson('/api/auth/register/resend', ['email' => 'amina@s.msumain.edu.ph'])->assertStatus(422)
            ->assertJsonPath('errors.code.0', RegistrationService::MSG_GONE);
        $this->assertSame(0, User::count());
    }

    public function test_filling_the_form_again_replaces_the_earlier_sign_up(): void
    {
        $this->postJson('/api/auth/register', $this->form())->assertStatus(202);
        $this->postJson('/api/auth/register', $this->form(['first_name' => 'Aminah']))->assertStatus(202);
        [$old, $new] = $this->codes('amina@s.msumain.edu.ph');

        $this->assertSame(1, PendingRegistration::count());
        $this->verify($old)->assertStatus(422);
        $this->verify($new)->assertCreated();
        $this->assertSame('Aminah', User::firstOrFail()->profile->first_name);
    }

    public function test_an_email_taken_meanwhile_is_refused_without_a_duplicate(): void
    {
        $this->postJson('/api/auth/register', $this->form())->assertStatus(202);
        $code = $this->codes('amina@s.msumain.edu.ph')[0];
        $this->makeUser('applicant', ['email' => 'amina@s.msumain.edu.ph']); // registered some other way first

        $this->verify($code)->assertStatus(422)->assertJsonPath('errors.email.0', RegistrationService::MSG_EMAIL_TAKEN);
        $this->assertSame(1, User::where('email', 'amina@s.msumain.edu.ph')->count());
    }

    public function test_closed_applications_still_block_sign_up(): void
    {
        Setting::put('applications_open', '0');
        $this->postJson('/api/auth/register', $this->form())->assertStatus(403);
        $this->assertSame(0, PendingRegistration::count());
    }
}
