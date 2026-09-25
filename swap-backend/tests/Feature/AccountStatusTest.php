<?php

namespace Tests\Feature;

use App\Http\Middleware\EnsureActive;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * Deactivated accounts and stale tokens lose API access — login refusing them
 * is not enough, because a token issued earlier would otherwise keep working.
 */
class AccountStatusTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_new_tokens_expire_after_seven_days(): void
    {
        $user = $this->makeUser('recipient');
        $user->createToken('auth_token');

        $expiresAt = $user->tokens()->first()->expires_at;
        $this->assertNotNull($expiresAt);
        $this->assertTrue($expiresAt->between(now()->addDays(7)->subMinute(), now()->addDays(7)->addMinute()));
    }

    public function test_a_deactivated_users_existing_token_is_refused(): void
    {
        $user = $this->makeUser('recipient');
        $token = $user->createToken('auth_token')->plainTextToken;
        // Flipped directly (not via the admin endpoint) so the token survives —
        // this is the backstop path for tokens that outlive deactivation.
        $user->forceFill(['is_active' => false])->save();

        $this->withToken($token)->getJson('/api/profile')
            ->assertStatus(403)
            ->assertJsonPath('message', EnsureActive::MESSAGE);
    }

    public function test_a_deactivated_users_token_cannot_fetch_files(): void
    {
        $user = $this->makeUser('recipient', ['avatar_path' => 'avatars/x.jpg']);
        $token = $user->createToken('auth_token')->plainTextToken;
        $user->forceFill(['is_active' => false])->save();

        $this->getJson("/api/users/{$user->id}/avatar?token={$token}")->assertStatus(401);
    }

    public function test_deactivating_a_user_revokes_their_tokens(): void
    {
        $admin = $this->makeUser('admin');
        $user = $this->makeUser('recipient');
        $userToken = $user->createToken('auth_token')->plainTextToken;
        $adminToken = $admin->createToken('auth_token')->plainTextToken;

        $this->withToken($adminToken)->putJson("/api/admin/users/{$user->id}", ['is_active' => false])
            ->assertOk();

        $this->assertSame(0, $user->tokens()->count());
        $this->assertDatabaseHas('audit_logs', [
            'auditable_id' => $user->id,
            'action' => 'updated',
        ]);

        $this->app['auth']->forgetGuards();
        $this->withToken($userToken)->getJson('/api/profile')->assertStatus(401);
    }

    public function test_an_expired_token_is_refused(): void
    {
        $user = $this->makeUser('recipient');
        $token = $user->createToken('auth_token')->plainTextToken;
        $user->tokens()->update(['expires_at' => now()->subMinute()]);

        $this->withToken($token)->getJson('/api/profile')->assertStatus(401);
    }

    public function test_an_active_user_keeps_access(): void
    {
        $user = $this->makeUser('recipient');
        $token = $user->createToken('auth_token')->plainTextToken;

        $this->withToken($token)->getJson('/api/profile')->assertOk();
    }
}
