<?php

namespace Tests\Feature;

use App\Http\Requests\Auth\RegisterRequest;
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
            'student_id_number' => '202400999',
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'college' => 'CICS',
            'program' => 'BS Computer Science',
            'year_level' => 3,
        ], $overrides);
    }

    /** The code emailed to a sign-up (no account yet, so it goes to the plain address). */
    private function signUpCode(string $email): string
    {
        $code = null;
        Notification::assertSentOnDemand(\App\Notifications\OneTimeCodeNotification::class,
            function ($n, $channels, $notifiable) use ($email, &$code) {
                if (($notifiable->routes['mail'] ?? null) === $email) {
                    $code = $n->code;
                }

                return ($notifiable->routes['mail'] ?? null) === $email;
            });

        return $code;
    }

    private function confirmSignUp(string $email): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/auth/register/verify', ['email' => $email, 'code' => $this->signUpCode($email)]);
    }

    public function test_register_holds_the_form_until_the_code_is_confirmed(): void
    {
        Notification::fake();

        // No account (and no token) until the emailed code is entered.
        $this->postJson('/api/auth/register', $this->validRegisterPayload())->assertStatus(202)
            ->assertJsonPath('pending', true)->assertJsonMissingPath('token');
        $this->assertNull(User::where('email', 'juan@s.msumain.edu.ph')->first());
        $this->assertDatabaseMissing('student_profiles', ['student_id_number' => '202400999']);

        // The code creates the account, verified and active, and signs it in.
        $res = $this->confirmSignUp('juan@s.msumain.edu.ph')->assertCreated()->assertJsonStructure(['data' => ['id', 'role'], 'token']);
        $user = User::where('email', 'juan@s.msumain.edu.ph')->firstOrFail();
        $this->assertTrue($user->hasVerifiedEmail());
        $this->assertTrue((bool) $user->is_active);
        $this->assertSame('applicant', $res->json('data.role'));
        $this->withToken($res->json('token'))->getJson('/api/profile')->assertOk();
        $this->assertDatabaseCount('pending_registrations', 0);
    }

    public function test_names_are_capitalised_and_the_full_name_is_built_from_them(): void
    {
        Notification::fake();

        // Whatever full name is sent, it is First + middle initial + Last.
        $this->postJson('/api/auth/register', $this->validRegisterPayload([
            'first_name' => 'NORHADI', 'middle_name' => 'andres', 'last_name' => 'NORODIN',
            'name' => 'Someone Else Entirely',
        ]))->assertStatus(202);
        $this->confirmSignUp('juan@s.msumain.edu.ph')->assertCreated();

        $user = User::where('email', 'juan@s.msumain.edu.ph')->firstOrFail();
        $this->assertSame('Norhadi A. Norodin', $user->name);
        $this->assertSame(['Norhadi', 'Andres', 'Norodin'], [$user->profile->first_name, $user->profile->middle_name, $user->profile->last_name]);
    }

    public function test_student_id_must_be_exactly_nine_digits(): void
    {
        foreach (['2024-9999', '12345678', '1234567890', '20240999A'] as $badId) {
            $this->postJson('/api/auth/register', $this->validRegisterPayload([
                'email' => 'juan@s.msumain.edu.ph', 'student_id_number' => $badId,
            ]))->assertStatus(422)->assertJsonValidationErrors('student_id_number');
        }
    }

    public function test_fifth_year_is_allowed_for_engineering_and_accountancy(): void
    {
        Notification::fake();

        $this->postJson('/api/auth/register', $this->validRegisterPayload([
            'email' => 'eng@s.msumain.edu.ph', 'student_id_number' => '202400005',
            'college' => 'CoE', 'program' => 'BS Civil Engineering', 'year_level' => 5,
        ]))->assertStatus(202);

        $this->postJson('/api/auth/register', $this->validRegisterPayload([
            'email' => 'acc@s.msumain.edu.ph', 'student_id_number' => '202400006',
            'college' => 'CBAA', 'program' => 'BS Accountancy', 'year_level' => 5,
        ]))->assertStatus(202);

        // Every College of Engineering program, e.g. the ones whose names don't start with the discipline.
        $this->postJson('/api/auth/register', $this->validRegisterPayload([
            'email' => 'abe@s.msumain.edu.ph', 'student_id_number' => '202400008',
            'college' => 'CoE', 'program' => 'BS Agricultural and Biosystems Engineering', 'year_level' => 5,
        ]))->assertStatus(202);
    }

    public function test_fifth_year_is_rejected_for_four_year_programs(): void
    {
        $res = $this->postJson('/api/auth/register', $this->validRegisterPayload([
            'email' => 'psy@s.msumain.edu.ph', 'student_id_number' => '202400007',
            'college' => 'CSSH', 'program' => 'BS Psychology', 'year_level' => 5,
        ]));

        $res->assertStatus(422)->assertJsonPath('errors.year_level.0', RegisterRequest::MSG_NOT_FIVE_YEAR);

        // "Engineering" in the name isn't enough: BSET programs run four years.
        $this->postJson('/api/auth/register', $this->validRegisterPayload([
            'email' => 'bset@s.msumain.edu.ph', 'student_id_number' => '202400009',
            'college' => 'DET', 'program' => 'BSET Construction Engineering Management', 'year_level' => 5,
        ]))->assertStatus(422)->assertJsonPath('errors.year_level.0', RegisterRequest::MSG_NOT_FIVE_YEAR);
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
        config(['auth.login_otp' => false]); // the sign-in code is OneTimeCodeTest's subject
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

        // Now login works (sign-in code switched off here).
        config(['auth.login_otp' => false]);
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
