<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\StudentProfile;
use App\Models\TestingSnapshot;
use App\Models\TimeLog;
use App\Support\AccountSnapshot;
use App\Support\TestTools;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** SWAP_TEST_TOOLS (config swap.test_tools) is System Testing's only on/off switch, live and local. */
class TestToolsAvailabilityTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function serverAllowsTesting(bool $on): void
    {
        config(['swap.test_tools' => $on]);
    }

    public function test_off_on_the_server_the_page_its_panels_and_bypasses_are_gone(): void
    {
        $admin = $this->makeUser('admin', ['email_verified_at' => now()]);
        config(['auth.login_otp' => true]);
        $student = $this->makeUser('recipient');
        $student->forceFill(['testing_added_at' => now()])->save();
        $this->serverAllowsTesting(false);
        Sanctum::actingAs($admin);

        $this->getJson('/api/admin/testing')->assertNotFound()->assertJsonPath('message', TestTools::MSG_UNAVAILABLE);
        $this->putJson('/api/admin/testing/switch', ['enabled' => true])->assertNotFound();
        $this->postJson("/api/admin/testing/accounts/{$student->id}")->assertNotFound();
        // The sign-in code switch lives on System Testing, so it goes with it (LOGIN_OTP still works on the server).
        $this->putJson('/api/admin/testing/login-code', ['enabled' => false, 'password' => 'Password@123'])->assertNotFound();
        $this->assertFalse(TestTools::enabled());
        $this->assertFalse(TestTools::bypasses($student), 'no rule is bypassed');

        // The sidebar's flag.
        $this->getJson('/api/admin/system')->assertOk()->assertExactJson(['data' => ['test_tools_available' => false]]);

        $this->serverAllowsTesting(true);
        $this->getJson('/api/admin/system')->assertJsonPath('data.test_tools_available', true);
        $this->getJson('/api/admin/testing')->assertOk();
    }

    public function test_shutdown_restores_every_test_account_where_the_server_turns_it_off(): void
    {
        Storage::fake(config('filesystems.documents_disk', 'public'));
        $admin = $this->makeUser('admin', ['email_verified_at' => now()]);
        $student = $this->makeUser('recipient');
        StudentProfile::create([
            'user_id' => $student->id, 'student_id_number' => '202155555', 'first_name' => 'Jumailah', 'last_name' => 'Test',
            'college' => 'CICS', 'program' => 'BSIT', 'year_level' => 3,
        ]);
        $assignment = $this->makeAssignment($student, $this->makeUser('supervisor'), null, ['required_hours' => 20]);
        $this->makeClosedLog($assignment, 3);
        $before = json_decode(json_encode(app(AccountSnapshot::class)->current($student->id)), true);

        // Picked and tested on a server that allows it…
        $this->serverAllowsTesting(true);
        Sanctum::actingAs($admin);
        $this->postJson("/api/admin/testing/accounts/{$student->id}")->assertOk();
        $this->postJson("/api/admin/testing/recipients/{$student->id}/complete-hours")->assertOk();
        $this->assertGreaterThan(1, TimeLog::where('user_id', $student->id)->count());

        // …then the server turns it off: the boot command puts everything back.
        $this->serverAllowsTesting(false);
        $this->app['auth']->forgetGuards(); // the boot command runs with nobody signed in
        $this->artisan('testing:shutdown')->assertSuccessful()
            ->expectsOutputToContain('Accounts restored and released: 1.');

        $this->assertSame($before, json_decode(json_encode(app(AccountSnapshot::class)->current($student->id)), true));
        $this->assertNull($student->fresh()->testing_added_at);
        $this->assertSame(0, TestingSnapshot::count());
        $released = AuditLog::where('action', 'testing_released_all')->firstOrFail();
        $this->assertNull($released->user_id, 'done by the server, not an admin');

        // Nothing left to do on the next boot.
        $this->artisan('testing:shutdown')->assertSuccessful()->expectsOutputToContain('no account is in testing');
    }

    public function test_shutdown_does_nothing_where_testing_is_allowed(): void
    {
        $student = $this->makeUser('recipient');
        $student->forceFill(['testing_added_at' => now()])->save();
        $this->serverAllowsTesting(true);

        $this->artisan('testing:shutdown')->assertSuccessful()->expectsOutputToContain('nothing to do');

        $this->assertNotNull($student->fresh()->testing_added_at);
    }
}
