<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    private function validRegisterPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Juan Dela Cruz',
            'email' => 'juan@student.msu-marawi.edu.ph',
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

    public function test_register_creates_applicant_with_token(): void
    {
        $res = $this->postJson('/api/auth/register', $this->validRegisterPayload());

        $res->assertStatus(201)
            ->assertJsonPath('data.role', 'applicant')
            ->assertJsonStructure(['data' => ['id', 'email', 'role'], 'token']);

        $this->assertDatabaseHas('users', [
            'email' => 'juan@student.msu-marawi.edu.ph',
            'role' => 'applicant',
        ]);
    }

    public function test_register_duplicate_email_is_rejected(): void
    {
        User::create([
            'name' => 'Existing', 'email' => 'dupe@student.msu-marawi.edu.ph',
            'password' => 'Password@123', 'role' => 'applicant', 'is_active' => true,
        ]);

        $res = $this->postJson('/api/auth/register', $this->validRegisterPayload([
            'email' => 'dupe@student.msu-marawi.edu.ph',
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
        ]);

        $res = $this->postJson('/api/auth/login', [
            'email' => 'ali@student.msu-marawi.edu.ph',
            'password' => 'Student@12345',
        ]);

        $res->assertStatus(200)
            ->assertJsonStructure(['data' => ['id', 'email', 'role'], 'token']);
        $this->assertNotEmpty($res->json('token'));
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
        User::create([
            'name' => 'Inactive', 'email' => 'inactive@student.msu-marawi.edu.ph',
            'password' => 'Student@12345', 'role' => 'applicant', 'is_active' => false,
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
