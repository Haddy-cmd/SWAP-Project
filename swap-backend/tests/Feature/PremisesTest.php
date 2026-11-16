<?php

namespace Tests\Feature;

use App\Models\TimeLog;
use App\Models\User;
use App\Notifications\AutoClockedOutNotification;
use App\Notifications\LeftPremisesNotification;
use App\Services\AttendanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * Leaving the office while clocked in: the server keeps when the recipient left, so the 10-minute
 * countdown survives reloads and shows on every page, notifies them, and clocks them out at the
 * deadline — also with the app closed (scheduler, or the next page load).
 */
class PremisesTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private const OUTSIDE = ['latitude' => 8.01, 'longitude' => 124.0, 'accuracy' => 10]; // ~1.1 km away
    private const INSIDE = ['latitude' => 8.0, 'longitude' => 124.0, 'accuracy' => 10];

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        // A weekday, mid-morning in Manila.
        $this->travelTo(Carbon::parse('2026-11-17 02:00:00', 'UTC')); // 10:00 AM Manila
    }

    /** @return array{0: User, 1: TimeLog} */
    private function clockedIn(array $office = []): array
    {
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $this->makeSupervisorWithoutSelfie(), $this->makeGeofencedOffice($office + ['name' => 'Library']));

        return [$recipient, $this->makeOpenLog($assignment, $recipient, now()->subHours(2))];
    }

    private function report(array $where)
    {
        return $this->postJson('/api/recipient/attendance/premises', $where);
    }

    public function test_leaving_is_recorded_once_survives_reloads_and_clears_on_return(): void
    {
        [$recipient, $log] = $this->clockedIn();
        Sanctum::actingAs($recipient);

        $left = now()->toISOString();
        $this->report(self::OUTSIDE)->assertOk()
            ->assertJsonPath('inside', false)->assertJsonPath('clocked_out', false)
            ->assertJsonPath('data.left_premises_at', $left)
            ->assertJsonPath('data.auto_clock_out_deadline', now()->addMinutes(10)->toISOString());
        Notification::assertSentTo($recipient, LeftPremisesNotification::class);

        // A reload (or any page) reads the same "left at", and later reports don't notify again.
        $this->travel(4)->minutes();
        $this->getJson('/api/recipient/attendance/current')->assertJsonPath('data.left_premises_at', $left);
        $this->report(self::OUTSIDE)->assertOk()->assertJsonPath('data.left_premises_at', $left);
        Notification::assertSentToTimes($recipient, LeftPremisesNotification::class, 1);

        // Back inside: the countdown is cleared.
        $this->report(self::INSIDE)->assertOk()->assertJsonPath('inside', true)->assertJsonPath('data.left_premises_at', null);
        $this->assertNull($log->fresh()->left_premises_at);
        Notification::assertNotSentTo($recipient, AutoClockedOutNotification::class);
    }

    public function test_still_away_after_ten_minutes_is_clocked_out_at_the_deadline(): void
    {
        [$recipient, $log] = $this->clockedIn();
        Sanctum::actingAs($recipient);
        $this->report(self::OUTSIDE)->assertOk();
        $deadline = now()->addMinutes(AttendanceService::AUTO_CLOCK_OUT_GRACE_MINUTES);

        $this->travel(13)->minutes();
        $this->report(self::OUTSIDE)->assertOk()->assertJsonPath('clocked_out', true)
            ->assertJsonPath('data.status', 'pending_verification')
            ->assertJsonPath('data.clocked_out_reason', 'auto');

        // Time away past the grace period isn't credited.
        $this->assertTrue($log->fresh()->time_out->eq($deadline));
        Notification::assertSentTo($recipient, AutoClockedOutNotification::class);
    }

    public function test_the_server_clocks_out_with_the_app_closed(): void
    {
        [$recipient, $log] = $this->clockedIn();
        Sanctum::actingAs($recipient);
        $this->report(self::OUTSIDE)->assertOk();

        // Nine minutes: not yet.
        $this->travel(9)->minutes();
        $this->artisan('attendance:auto-clock-out')->assertSuccessful();
        $this->assertSame('open', $log->fresh()->status);

        // Past the deadline: the scheduler closes it, no page open.
        $this->travel(3)->minutes();
        $this->artisan('attendance:auto-clock-out')->assertSuccessful();
        $this->assertSame('pending_verification', $log->fresh()->status);
        Notification::assertSentTo($recipient, AutoClockedOutNotification::class);
    }

    public function test_opening_the_app_closes_an_overdue_absence_if_the_scheduler_missed_it(): void
    {
        [$recipient, $log] = $this->clockedIn();
        Sanctum::actingAs($recipient);
        $this->report(self::OUTSIDE)->assertOk();
        $deadline = now()->addMinutes(10);

        $this->travel(40)->minutes();
        $this->getJson('/api/recipient/attendance/current')->assertOk()->assertJsonPath('data', null);
        $this->assertTrue($log->fresh()->time_out->eq($deadline));
    }

    public function test_offices_without_auto_clock_out_are_not_watched(): void
    {
        [$recipient, $log] = $this->clockedIn(['auto_clock_out' => false]);
        Sanctum::actingAs($recipient);

        $this->report(self::OUTSIDE)->assertStatus(422)->assertJsonPath('message', AttendanceService::MSG_AUTO_CLOCK_OUT_OFF);
        $this->assertNull($log->fresh()->left_premises_at);
        Notification::assertNothingSent();

        // Not clocked in: nothing to watch.
        Sanctum::actingAs($this->makeUser('recipient'));
        $this->report(self::OUTSIDE)->assertStatus(422);
    }
}
