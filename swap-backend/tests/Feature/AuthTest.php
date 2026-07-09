<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Registration is gated by the application period.
        \App\Models\Setting::put('applications_open', '1');
    }

    private function validRegisterPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Juan Dela Cruz',
            'email' => 'juan@s.msumain.edu.ph',
            'password' => 'Password@123',
            'password_confirmation' => 'Password@123',
            'student_id_number' => '2024-9999',
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'college' => 'CSST',
            'program' => 'BSCS',
            'year_level' => 3,
        ], $overrides);
    }

    public function test_register_requires_email_verification(): void
    {
        Notification::fake();

        $res = $this->postJson('/api/auth/register', $this->validRegisterPayload());

        // No token/auto-login — the applicant must verify their email first.
        $res->assertStatus(201)->assertJsonPath('verification_required', true);
        $res->assertJsonMissing(['token' => true]);

        $user = User::where('email', 'juan@s.msumain.edu.ph')->first();
        $this->assertNotNull($user);
        $this->assertFalse($user->hasVerifiedEmail());
        // Unverified accounts start inactive so they don't show as active applicants.
        $this->assertFalse((bool) $user->is_active);
        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_register_duplicate_email_is_rejected(): void
    {
        User::create([
            'name' => 'Existing', 'email' => 'dupe@s.msumain.edu.ph',
            'password' => 'Password@123', 'role' => 'applicant', 'is_active' => true,
        ]);

        $res = $this->postJson('/api/auth/register', $this->validRegisterPayload([
            'email' => 'dupe@s.msumain.edu.ph',
        ]));

        $res->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_register_weak_password_is_rejected(): void
    {
        $res = $this->postJson('/api/auth/register', $this->validRegisterPayload([
            'password' => 'weak', 'password_confirmation' => 'weak',
        ]));

        $res->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_login_with_valid_credentials_returns_token(): void
    {
        User::create([
            'name' => 'Ali Hassan', 'email' => 'ali@student.msu-marawi.edu.ph',
            'password' => 'Student@12345', 'role' => 'applicant', 'is_active' => true,
            'email_verified_at' => now(),
        ]);

        $res = $this->postJson('/api/auth/login', [
            'email' => 'ali@student.msu-marawi.edu.ph',
            'password' => 'Student@12345',
        ]);

        $res->assertStatus(200)
            ->assertJsonStructure(['data' => ['id', 'email', 'role'], 'token']);
        $this->assertNotEmpty($res->json('token'));
    }

    public function test_login_is_blocked_until_email_is_verified(): void
    {
        User::create([
            'name' => 'Unverified', 'email' => 'unverified@s.msumain.edu.ph',
            'password' => 'Student@12345', 'role' => 'applicant', 'is_active' => true,
            'email_verified_at' => null,
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'unverified@s.msumain.edu.ph',
            'password' => 'Student@12345',
        ])->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_verification_link_verifies_the_email(): void
    {
        // A fresh, inactive/unverified registration.
        $user = User::create([
            'name' => 'Verify Me', 'email' => 'verifyme@s.msumain.edu.ph',
            'password' => 'Student@12345', 'role' => 'applicant', 'is_active' => false,
            'email_verified_at' => null,
        ]);

        $url = URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), [
            'id' => $user->id,
            'hash' => sha1($user->getEmailForVerification()),
        ]);

        $this->get($url)->assertRedirect();
        // Verifying both confirms the email and activates the account.
        $this->assertTrue($user->fresh()->hasVerifiedEmail());
        $this->assertTrue((bool) $user->fresh()->is_active);

        // Now login works.
        $this->postJson('/api/auth/login', [
            'email' => 'verifyme@s.msumain.edu.ph', 'password' => 'Student@12345',
        ])->assertStatus(200)->assertJsonStructure(['token']);
    }

    public function test_login_with_wrong_password_is_rejected(): void
    {
        User::create([
            'name' => 'Ali', 'email' => 'ali@student.msu-marawi.edu.ph',
            'password' => 'Student@12345', 'role' => 'applicant', 'is_active' => true,
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'ali@student.msu-marawi.edu.ph',
            'password' => 'WrongPassword1',
        ])->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_login_inactive_user_is_blocked(): void
    {
        // Verified but admin-deactivated — should hit the deactivated block.
        User::create([
            'name' => 'Inactive', 'email' => 'inactive@student.msu-marawi.edu.ph',
            'password' => 'Student@12345', 'role' => 'applicant', 'is_active' => false,
            'email_verified_at' => now(),
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'inactive@student.msu-marawi.edu.ph',
            'password' => 'Student@12345',
        ])->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_logout_revokes_token(): void
    {
        $user = User::create([
            'name' => 'Ali', 'email' => 'ali@student.msu-marawi.edu.ph',
            'password' => 'Student@12345', 'role' => 'applicant', 'is_active' => true,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;
        $this->assertEquals(1, $user->tokens()->count());

        // Logout (token-authenticated) must revoke the access token.
        $this->withToken($token)->postJson('/api/auth/logout')->assertStatus(200);
        $this->assertEquals(0, $user->fresh()->tokens()->count());

        // The revoked token must no longer authenticate. Clear any cached guard
        // resolution so the token is re-validated against the database.
        $this->app['auth']->forgetGuards();
        $this->flushSession();
        $this->withToken($token)->getJson('/api/profile')->assertStatus(401);
    }
}
