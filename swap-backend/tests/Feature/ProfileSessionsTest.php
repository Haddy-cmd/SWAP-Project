<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Support\DeviceName;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Profile → Security → "Where you're signed in". */
class ProfileSessionsTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private const CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

    private const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

    public function test_login_remembers_the_device(): void
    {
        $user = $this->makeUser('recipient');
        $user->forceFill(['email_verified_at' => now()])->save();
        config(['auth.login_otp' => false]);

        $this->withHeader('User-Agent', self::CHROME_WIN)
            ->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'Password@123'])->assertOk();

        $token = $user->tokens()->firstOrFail();
        $this->assertSame(self::CHROME_WIN, $token->user_agent);
        $this->assertNotNull($token->ip_address);
    }

    public function test_the_list_marks_this_device_and_names_the_others(): void
    {
        $user = $this->makeUser('recipient');
        $mine = $user->createToken('auth_token')->plainTextToken;
        $user->tokens()->latest('id')->first()->update(['user_agent' => self::CHROME_WIN]);
        $user->createToken('auth_token');
        $user->tokens()->latest('id')->first()->update(['user_agent' => self::SAFARI_IPHONE]);
        $user->createToken('auth_token'); // an old login: no device recorded
        $expired = $user->createToken('auth_token');
        $user->tokens()->latest('id')->first()->update(['expires_at' => now()->subMinute()]);
        $this->makeUser('recipient')->createToken('auth_token'); // someone else's

        $res = $this->withToken($mine)->getJson('/api/profile/sessions')->assertOk()->assertJsonCount(3, 'data');
        $this->assertSame('Chrome on Windows', $res->json('data.0.device'));
        $this->assertTrue($res->json('data.0.current'));
        $devices = collect($res->json('data'))->pluck('device');
        $this->assertContains('Safari on iPhone', $devices);
        $this->assertContains('Unknown device', $devices);
        $this->assertSame(1, collect($res->json('data'))->where('current', true)->count());
    }

    public function test_signing_out_one_device(): void
    {
        $user = $this->makeUser('supervisor');
        $mine = $user->createToken('auth_token')->plainTextToken;
        $currentId = $user->tokens()->latest('id')->value('id');
        $phone = $user->createToken('auth_token')->plainTextToken;
        $phoneId = $user->tokens()->latest('id')->value('id');
        $user->tokens()->whereKey($phoneId)->update(['user_agent' => self::SAFARI_IPHONE]);
        $other = $this->makeUser('recipient');
        $other->createToken('auth_token');
        $othersId = $other->tokens()->value('id');

        $this->withToken($mine)->deleteJson("/api/profile/sessions/{$currentId}")->assertStatus(422)
            ->assertJsonPath('errors.session.0', 'Use Sign out to end this session.');
        $this->withToken($mine)->deleteJson("/api/profile/sessions/{$othersId}")->assertNotFound();
        $this->withToken($mine)->deleteJson("/api/profile/sessions/{$phoneId}")->assertOk();

        $this->assertSame([$currentId], $user->tokens()->pluck('id')->all());
        $this->assertSame(1, $other->tokens()->count());
        $log = AuditLog::where('action', 'session_revoked')->firstOrFail();
        $this->assertSame($user->id, $log->user_id);
        $this->assertSame('Safari on iPhone', $log->new_values['device']);

        $this->app['auth']->forgetGuards();
        $this->withToken($phone)->getJson('/api/profile')->assertStatus(401);
    }

    public function test_signing_out_every_other_device_keeps_this_one(): void
    {
        $user = $this->makeUser('recipient');
        $mine = $user->createToken('auth_token')->plainTextToken;
        $currentId = $user->tokens()->value('id');
        $user->createToken('auth_token');
        $user->createToken('auth_token');

        $this->withToken($mine)->deleteJson('/api/profile/sessions/others')->assertOk()
            ->assertJsonPath('data.count', 2)
            ->assertJsonPath('message', 'Signed out of 2 other devices.');
        $this->assertSame([$currentId], $user->tokens()->pluck('id')->all());
        $this->assertSame(2, AuditLog::where('action', 'sessions_revoked')->value('new_values')['count']);

        // Nothing left to end: no empty audit entry.
        $this->withToken($mine)->deleteJson('/api/profile/sessions/others')->assertOk()->assertJsonPath('data.count', 0);
        $this->assertSame(1, AuditLog::where('action', 'sessions_revoked')->count());
    }

    public function test_device_names(): void
    {
        $this->assertSame(['label' => 'Chrome on Windows', 'kind' => 'desktop'], DeviceName::from(self::CHROME_WIN));
        $this->assertSame(['label' => 'Safari on iPhone', 'kind' => 'phone'], DeviceName::from(self::SAFARI_IPHONE));
        $this->assertSame('Edge on Windows', DeviceName::from('Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0')['label']);
        $this->assertSame(['label' => 'Unknown device', 'kind' => 'unknown'], DeviceName::from(null));
    }
}
