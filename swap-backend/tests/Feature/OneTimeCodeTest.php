<?php

namespace Tests\Feature;

use App\Models\OneTimeCode;
use App\Models\Setting;
use App\Models\TrustedDevice;
use App\Models\User;
use App\Notifications\OneTimeCodeNotification;
use App\Services\OneTimeCodeService;
use App\Support\TestTools;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Emailed 6-digit codes: verify email, sign in (with trusted browsers), reset password. */
class OneTimeCodeTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        config(['auth.login_otp' => true]);
    }

    /** The latest code emailed to this user for this purpose. */
    private function lastCode(User $user, string $purpose): string
    {
        $code = null;
        Notification::assertSentTo($user, OneTimeCodeNotification::class, function (OneTimeCodeNotification $n) use ($purpose, &$code) {
            if ($n->purpose === $purpose) {
                $code = $n->code;
            }

            return $n->purpose === $purpose;
        });

        return $code;
    }

    private function account(array $attrs = []): User
    {
        return $this->makeUser('recipient', $attrs + ['email_verified_at' => now()]);
    }

    private function wrong(string $code): string
    {
        return str_pad((string) (((int) $code + 1) % 1000000), 6, '0', STR_PAD_LEFT);
    }

    /** Accounts made before sign-up waited for the code: still verified on /verify-email. */
    public function test_an_old_unverified_account_is_verified_with_the_emailed_code(): void
    {
        $user = $this->makeUser('applicant', ['email' => 'amina@s.msumain.edu.ph', 'email_verified_at' => null, 'is_active' => false]);
        $this->postJson('/api/auth/resend-verification', ['email' => $user->email])->assertOk();
        $user = User::where('email', 'amina@s.msumain.edu.ph')->firstOrFail();
        $code = $this->lastCode($user, OneTimeCode::VERIFY_EMAIL);
        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);
        $this->assertDatabaseMissing('one_time_codes', ['code_hash' => $code]); // only an HMAC is kept

        $this->postJson('/api/auth/verify-email', ['email' => $user->email, 'code' => $this->wrong($code)])->assertStatus(422)
            ->assertJsonPath('errors.code.0', OneTimeCodeService::MSG_WRONG);
        $this->postJson('/api/auth/verify-email', ['email' => $user->email, 'code' => substr($code, 0, 3) . ' ' . substr($code, 3)])
            ->assertOk()->assertJsonPath('verified', true);
        $this->assertTrue($user->fresh()->hasVerifiedEmail());
        $this->assertTrue((bool) $user->fresh()->is_active);

        // Used up; and an unknown address gets the same answer as a wrong code.
        $this->postJson('/api/auth/verify-email', ['email' => 'nobody@s.msumain.edu.ph', 'code' => '123456'])->assertStatus(422)
            ->assertJsonPath('errors.code.0', OneTimeCodeService::MSG_WRONG);
    }

    public function test_codes_expire_lock_after_five_tries_and_resend_once_a_minute(): void
    {
        $user = $this->makeUser('applicant', ['email_verified_at' => null, 'is_active' => false]);
        $codes = app(OneTimeCodeService::class);
        $codes->issue($user, OneTimeCode::VERIFY_EMAIL);
        $code = $this->lastCode($user, OneTimeCode::VERIFY_EMAIL);

        // Resend within a minute: the reply stays the same, no new code goes out.
        $this->postJson('/api/auth/resend-verification', ['email' => $user->email])->assertOk();
        Notification::assertSentToTimes($user, OneTimeCodeNotification::class, 1);

        for ($i = 0; $i < 4; $i++) {
            $this->postJson('/api/auth/verify-email', ['email' => $user->email, 'code' => $this->wrong($code)])
                ->assertJsonPath('errors.code.0', OneTimeCodeService::MSG_WRONG);
        }
        $this->postJson('/api/auth/verify-email', ['email' => $user->email, 'code' => $this->wrong($code)])
            ->assertJsonPath('errors.code.0', OneTimeCodeService::MSG_TOO_MANY);
        $this->postJson('/api/auth/verify-email', ['email' => $user->email, 'code' => $code])
            ->assertJsonPath('errors.code.0', OneTimeCodeService::MSG_TOO_MANY);

        $this->travel(2)->minutes();
        $this->postJson('/api/auth/resend-verification', ['email' => $user->email])->assertOk();
        $fresh = $this->lastCode($user, OneTimeCode::VERIFY_EMAIL);
        $this->travel(11)->minutes();
        $this->postJson('/api/auth/verify-email', ['email' => $user->email, 'code' => $fresh])
            ->assertJsonPath('errors.code.0', OneTimeCodeService::MSG_EXPIRED);
    }

    public function test_sign_in_needs_the_code_and_can_trust_the_browser(): void
    {
        $user = $this->account(['email' => 'ana@s.msumain.edu.ph']);

        $step1 = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Password@123'])->assertOk()
            ->assertJsonPath('otp_required', true)
            ->assertJsonPath('email_hint', 'a**@s.msumain.edu.ph')
            ->assertJsonMissingPath('token');
        $this->assertSame(0, $user->tokens()->count());
        $code = $this->lastCode($user, OneTimeCode::LOGIN);
        $challenge = $step1->json('challenge');

        $this->postJson('/api/auth/login/verify', ['challenge' => $challenge, 'code' => $this->wrong($code)])->assertStatus(422);
        $this->postJson('/api/auth/login/verify', ['challenge' => 'made-up', 'code' => $code])->assertStatus(422)
            ->assertJsonPath('errors.code.0', 'This sign-in has expired. Enter your password again.');
        $done = $this->postJson('/api/auth/login/verify', ['challenge' => $challenge, 'code' => $code, 'trust_device' => true])
            ->assertOk()->assertJsonStructure(['data' => ['id'], 'token', 'device_token']);
        $device = $done->json('device_token');
        $this->assertSame(1, TrustedDevice::where('user_id', $user->id)->count());

        // The same browser skips the code; another doesn't.
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Password@123', 'device_token' => $device])
            ->assertOk()->assertJsonStructure(['token'])->assertJsonMissingPath('otp_required');
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Password@123', 'device_token' => 'other'])
            ->assertJsonPath('otp_required', true);

        // A password change makes every browser ask again.
        OneTimeCodeService::forgetDevices($user);
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Password@123', 'device_token' => $device])
            ->assertJsonPath('otp_required', true);
    }

    public function test_the_switch_turns_the_sign_in_code_off(): void
    {
        config(['auth.login_otp' => false]);
        $user = $this->account();

        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Password@123'])
            ->assertOk()->assertJsonStructure(['token']);
        Notification::assertNothingSent();
    }

    public function test_admin_can_switch_sign_in_codes_off_and_on_from_system_testing(): void
    {
        $admin = $this->makeUser('admin', ['email_verified_at' => now()]);
        $user = $this->account();
        \Laravel\Sanctum\Sanctum::actingAs($admin);

        $this->getJson('/api/admin/testing')->assertOk()
            ->assertJsonPath('data.login_code', ['required' => true, 'server_off' => false, 'page_on' => true]);
        $this->putJson('/api/admin/testing/login-code', ['enabled' => false, 'password' => 'wrong'])->assertStatus(422)
            ->assertJsonPath('errors.password.0', 'That password is incorrect.');
        $this->assertTrue(OneTimeCodeService::loginCodeRequired(), 'nothing changed');

        $this->putJson('/api/admin/testing/login-code', ['enabled' => false, 'password' => 'Password@123'])->assertOk()
            ->assertJsonPath('message', 'Sign-in codes are off for everyone.')
            ->assertJsonPath('data.login_code.required', false);
        $log = \App\Models\AuditLog::where('action', 'login_code_switched')->firstOrFail();
        $this->assertSame($admin->id, $log->user_id);
        $this->assertNull($log->subject_user_id);

        // Off: password only. Verification/reset codes still go out.
        $this->app['auth']->forgetGuards();
        $this->app['auth']->shouldUse('web'); // a plain visitor signing in
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Password@123'])->assertOk()->assertJsonStructure(['token']);
        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])->assertOk();
        $this->lastCode($user, OneTimeCode::PASSWORD_RESET);

        \Laravel\Sanctum\Sanctum::actingAs($admin);
        $this->putJson('/api/admin/testing/login-code', ['enabled' => true, 'password' => 'Password@123'])->assertOk();
        $this->app['auth']->forgetGuards();
        $this->app['auth']->shouldUse('web');
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Password@123'])->assertJsonPath('otp_required', true);
    }

    public function test_the_server_switch_wins_and_only_admins_may_flip_it(): void
    {
        config(['auth.login_otp' => false]);
        $admin = $this->makeUser('admin', ['email_verified_at' => now()]);
        \Laravel\Sanctum\Sanctum::actingAs($admin);

        $this->getJson('/api/admin/testing')->assertJsonPath('data.login_code.server_off', true)->assertJsonPath('data.login_code.required', false);
        $this->putJson('/api/admin/testing/login-code', ['enabled' => true, 'password' => 'Password@123'])->assertStatus(422)
            ->assertJsonPath('message', OneTimeCodeService::MSG_SERVER_OFF);

        \Laravel\Sanctum\Sanctum::actingAs($this->makeUser('supervisor'));
        $this->putJson('/api/admin/testing/login-code', ['enabled' => false, 'password' => 'Password@123'])->assertForbidden();
    }

    public function test_password_reset_by_code(): void
    {
        $user = $this->account();
        $user->createToken('auth_token');

        // No account, or a deactivated one: said plainly, nothing sent.
        $inactive = $this->account(['is_active' => false]);
        foreach (['nobody@s.msumain.edu.ph', $inactive->email] as $email) {
            $this->postJson('/api/auth/forgot-password', ['email' => $email])->assertStatus(422)
                ->assertJsonPath('errors.email.0', \App\Http\Controllers\Auth\PasswordResetController::MSG_NO_ACCOUNT);
        }
        Notification::assertNotSentTo($inactive, OneTimeCodeNotification::class);
        $this->postJson('/api/auth/reset-password', ['email' => 'nobody@s.msumain.edu.ph', 'code' => '123456',
            'password' => 'NewPassword@456', 'password_confirmation' => 'NewPassword@456'])->assertStatus(422)
            ->assertJsonPath('errors.email.0', \App\Http\Controllers\Auth\PasswordResetController::MSG_NO_ACCOUNT);

        $this->travel(61)->seconds(); // past the 3-a-minute limit those tries used up
        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])->assertOk()
            ->assertJsonPath('message', 'We sent a 6-digit code to your email.');
        $code = $this->lastCode($user, OneTimeCode::PASSWORD_RESET);
        // Asking again within the minute says so.
        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])->assertStatus(422)
            ->assertJsonPath('errors.email.0', OneTimeCodeService::MSG_WAIT);

        $payload = ['email' => $user->email, 'password' => 'NewPassword@456', 'password_confirmation' => 'NewPassword@456'];
        $this->postJson('/api/auth/reset-password', $payload + ['code' => $this->wrong($code)])->assertStatus(422);
        $this->postJson('/api/auth/reset-password', $payload + ['code' => $code])->assertOk();

        $this->assertSame(0, $user->tokens()->count(), 'every session ends');
        config(['auth.login_otp' => false]);
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'NewPassword@456'])->assertOk();
    }

    public function test_system_testing_never_mutes_the_code(): void
    {
        $user = $this->account(['testing_added_at' => now(), 'testing_email_muted' => true]);
        TestTools::setEnabled(true);

        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Password@123'])->assertJsonPath('otp_required', true);
        $this->assertFalse(TestTools::mutesEmail($user, new OneTimeCodeNotification('123456', OneTimeCode::LOGIN, 10)));
    }
}
