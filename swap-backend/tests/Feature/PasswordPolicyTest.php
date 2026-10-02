<?php

namespace Tests\Feature;

use App\Support\PasswordPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** New passwords: 8+ characters, upper- and lowercase, a number — with the frontend checklist's messages. */
class PasswordPolicyTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_weak_passwords_get_the_same_messages_as_the_form(): void
    {
        $user = $this->makeUser('recipient');
        Sanctum::actingAs($user);
        $change = fn (string $password) => $this->putJson('/api/profile/password', [
            'current_password' => 'Password@123', 'password' => $password, 'password_confirmation' => $password,
        ]);

        $change('Ab1')->assertStatus(422)->assertJsonPath('errors.password', [PasswordPolicy::MSG_MIN]);
        $change('password123')->assertStatus(422)->assertJsonPath('errors.password', [PasswordPolicy::MSG_MIXED]);
        $change('Passwordabc')->assertStatus(422)->assertJsonPath('errors.password', [PasswordPolicy::MSG_NUMBERS]);
        $change('password')->assertStatus(422)->assertJsonPath('errors.password', [PasswordPolicy::MSG_MIXED, PasswordPolicy::MSG_NUMBERS]);

        $change('NewPassword1')->assertOk();
    }
}
