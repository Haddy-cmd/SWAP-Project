<?php

namespace Tests\Feature;

use App\Models\TimeLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

class AttendanceTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    /** Freeze time inside the allowed clock-in window (Mon 9:00 AM PHT) so time-based tests are deterministic. */
    private function travelToValidClockIn(): void
    {
        $this->travelTo(Carbon::create(2026, 7, 6, 9, 0, 0, 'Asia/Manila'));
    }

    public function test_geofenced_time_in_within_premises_opens_a_log(): void
    {
        $this->travelToValidClockIn();
        $recipient = $this->makeUser('recipient');
        $office = $this->makeGeofencedOffice();
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'), $office);
        $token = $this->qrForOffice($office);

        Sanctum::actingAs($recipient);
        $res = $this->postJson('/api/recipient/attendance/time-in-geofence', [
            'qr_token' => $token, 'latitude' => 8.0, 'longitude' => 124.0, 'accuracy' => 10,
        ]);

        $res->assertStatus(201)->assertJsonPath('data.status', 'open');
        $this->assertNull($res->json('data.time_out'));
        $this->assertDatabaseHas('time_logs', [
            'user_id' => $recipient->id, 'assignment_id' => $assignment->id, 'status' => 'open',
        ]);
    }

    public function test_second_time_in_same_day_conflicts(): void
    {
        $this->travelToValidClockIn();
        $recipient = $this->makeUser('recipient');
        $office = $this->makeGeofencedOffice();
        $this->makeAssignment($recipient, $this->makeUser('supervisor'), $office);
        $token = $this->qrForOffice($office);
        $payload = ['qr_token' => $token, 'latitude' => 8.0, 'longitude' => 124.0];

        Sanctum::actingAs($recipient);
        $this->postJson('/api/recipient/attendance/time-in-geofence', $payload)->assertStatus(201);
        $this->postJson('/api/recipient/attendance/time-in-geofence', $payload)->assertStatus(409);
    }

    public function test_open_log_from_a_previous_day_blocks_a_new_clock_in(): void
    {
        $this->travelToValidClockIn();
        $recipient = $this->makeUser('recipient');
        $office = $this->makeGeofencedOffice();
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'), $office);

        // A forgotten clock-out from yesterday leaves an open log.
        $this->makeOpenLog($assignment, $recipient, now()->subDay());

        Sanctum::actingAs($recipient);
        $this->postJson('/api/recipient/attendance/time-in-geofence', [
            'qr_token' => $this->qrForOffice($office), 'latitude' => 8.0, 'longitude' => 124.0,
        ])->assertStatus(409);
    }

    public function test_database_rejects_a_second_open_log_for_the_same_user(): void
    {
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'));

        $this->makeOpenLog($assignment, $recipient, now()->subMinutes(5));

        // The partial unique index must reject a second concurrent open log.
        $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);
        $this->makeOpenLog($assignment, $recipient, now());
    }

    public function test_void_duplicate_open_logs_closes_an_overlapping_twin(): void
    {
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'));
        $start = now()->subMinutes(5);

        // A completed (clocked-out, pending) session…
        TimeLog::create([
            'assignment_id' => $assignment->id, 'user_id' => $recipient->id,
            'date' => $start->toDateString(), 'time_in' => $start, 'time_out' => now(),
            'status' => 'pending_verification',
        ]);
        // …and an overlapping still-open twin from the same double clock-in.
        $twin = TimeLog::create([
            'assignment_id' => $assignment->id, 'user_id' => $recipient->id,
            'date' => $start->toDateString(), 'time_in' => $start, 'status' => 'open',
        ]);

        $voided = app(\App\Services\AttendanceService::class)->voidDuplicateOpenLogs();

        $this->assertSame(1, $voided);
        $twin->refresh();
        $this->assertSame('rejected', $twin->status);
        $this->assertEquals(0.0, (float) $twin->duration_hours);
        $this->assertSame(0, TimeLog::where('user_id', $recipient->id)->where('status', 'open')->count());
    }

    public function test_time_in_outside_geofence_is_rejected(): void
    {
        $recipient = $this->makeUser('recipient');
        $office = $this->makeGeofencedOffice();
        $this->makeAssignment($recipient, $this->makeUser('supervisor'), $office);
        $token = $this->qrForOffice($office);

        Sanctum::actingAs($recipient);
        // Coordinates on another continent — well outside the 100m radius.
        $this->postJson('/api/recipient/attendance/time-in-geofence', [
            'qr_token' => $token, 'latitude' => 40.0, 'longitude' => -74.0,
        ])->assertStatus(422);
    }

    public function test_clock_in_is_blocked_on_sunday(): void
    {
        $this->travelTo(Carbon::create(2026, 7, 5, 9, 0, 0, 'Asia/Manila')); // Sunday 9:00 AM PHT
        $recipient = $this->makeUser('recipient');
        $office = $this->makeGeofencedOffice();
        $this->makeAssignment($recipient, $this->makeUser('supervisor'), $office);

        Sanctum::actingAs($recipient);
        $res = $this->postJson('/api/recipient/attendance/time-in-geofence', [
            'qr_token' => $this->qrForOffice($office), 'latitude' => 8.0, 'longitude' => 124.0,
        ]);

        $res->assertStatus(422);
        $this->assertStringContainsStringIgnoringCase('Monday to Saturday', $res->json('message') ?? '');
    }

    public function test_clock_in_is_blocked_outside_office_hours(): void
    {
        $this->travelTo(Carbon::create(2026, 7, 6, 18, 0, 0, 'Asia/Manila')); // Monday 6:00 PM PHT (past 5:30)
        $recipient = $this->makeUser('recipient');
        $office = $this->makeGeofencedOffice();
        $this->makeAssignment($recipient, $this->makeUser('supervisor'), $office);

        Sanctum::actingAs($recipient);
        $res = $this->postJson('/api/recipient/attendance/time-in-geofence', [
            'qr_token' => $this->qrForOffice($office), 'latitude' => 8.0, 'longitude' => 124.0,
        ]);

        $res->assertStatus(422);
        $this->assertStringContainsStringIgnoringCase('6:00 AM and 5:30 PM', $res->json('message') ?? '');
    }

    public function test_time_in_with_tampered_office_qr_is_rejected(): void
    {
        $recipient = $this->makeUser('recipient');
        $office = $this->makeGeofencedOffice();
        $this->makeAssignment($recipient, $this->makeUser('supervisor'), $office);
        $tampered = substr($this->qrForOffice($office), 0, -1).'X';

        Sanctum::actingAs($recipient);
        $this->postJson('/api/recipient/attendance/time-in-geofence', [
            'qr_token' => $tampered, 'latitude' => 8.0, 'longitude' => 124.0,
        ])->assertStatus(422);
    }

    public function test_poor_gps_accuracy_flags_the_log(): void
    {
        $this->travelToValidClockIn();
        $recipient = $this->makeUser('recipient');
        $office = $this->makeGeofencedOffice();
        $this->makeAssignment($recipient, $this->makeUser('supervisor'), $office);
        $token = $this->qrForOffice($office);

        Sanctum::actingAs($recipient);
        $res = $this->postJson('/api/recipient/attendance/time-in-geofence', [
            'qr_token' => $token, 'latitude' => 8.0, 'longitude' => 124.0, 'accuracy' => 250,
        ]);

        $res->assertStatus(201)->assertJsonPath('data.location_flagged', true);
    }

    /**
     * P0 SACRED RULE: time-out must be blocked when no narrative exists.
     */
    public function test_time_out_without_narrative_is_blocked(): void
    {
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'));
        $token = $this->qrFor($assignment);
        $log = $this->makeOpenLog($assignment, $recipient);

        Sanctum::actingAs($recipient);
        $res = $this->postJson('/api/recipient/attendance/time-out', [
            'log_id' => $log->id, 'qr_token' => $token,
        ]);

        $res->assertStatus(422);
        $this->assertStringContainsStringIgnoringCase('narrative', $res->json('message') ?? '');
        $this->assertDatabaseHas('time_logs', ['id' => $log->id, 'status' => 'open']);
        $this->assertNull($log->fresh()->time_out);
    }

    public function test_time_out_with_narrative_succeeds_and_computes_duration(): void
    {
        Queue::fake();
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'));
        $token = $this->qrFor($assignment);
        $log = $this->makeOpenLog($assignment, $recipient, now()->subHours(3));
        $this->addNarrative($log);

        Sanctum::actingAs($recipient);
        $res = $this->postJson('/api/recipient/attendance/time-out', [
            'log_id' => $log->id, 'qr_token' => $token,
        ]);

        $res->assertStatus(200)->assertJsonPath('data.status', 'pending_verification');

        $fresh = TimeLog::find($log->id);
        $this->assertEquals('pending_verification', $fresh->status);
        $this->assertGreaterThan(0, (float) $fresh->duration_hours);
    }

    public function test_narrative_can_be_submitted_via_endpoint_then_timeout_succeeds(): void
    {
        Queue::fake();
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'));
        $token = $this->qrFor($assignment);
        $log = $this->makeOpenLog($assignment, $recipient, now()->subHours(2));

        Sanctum::actingAs($recipient);

        // time_log_id travels in the body (no route param) — this must bind.
        $this->postJson('/api/recipient/narratives', [
            'time_log_id' => $log->id,
            'content' => 'I assisted the office with filing and organizing records during my shift today.',
            'activities_done' => 'Filed documents and sorted records carefully.',
        ])->assertStatus(201);

        $this->assertDatabaseHas('narrative_reports', ['time_log_id' => $log->id]);

        $this->postJson('/api/recipient/attendance/time-out', [
            'log_id' => $log->id, 'qr_token' => $token,
        ])->assertStatus(200)->assertJsonPath('data.status', 'pending_verification');
    }

    public function test_close_stale_command_closes_old_open_logs_and_caps_duration(): void
    {
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'));
        $stale = $this->makeOpenLog($assignment, $recipient, now()->subHours(15));

        // A recent (<12h) open log for a different recipient must be left untouched.
        $fresh = $this->makeUser('recipient');
        $freshAssignment = $this->makeAssignment($fresh, $this->makeUser('supervisor'));
        $freshLog = $this->makeOpenLog($freshAssignment, $fresh, now()->subHours(2));

        $this->artisan('attendance:close-stale', ['--hours' => 12])->assertExitCode(0);

        $staleFresh = $stale->fresh();
        $this->assertSame('pending_verification', $staleFresh->status);
        $this->assertSame('auto_stale', $staleFresh->clocked_out_reason);
        $this->assertEquals(12.0, (float) $staleFresh->duration_hours); // capped at time_in + 12h

        $this->assertSame('open', $freshLog->fresh()->status);
    }

    public function test_supervisor_clocked_in_excludes_stale_open_logs(): void
    {
        $supervisor = $this->makeUser('supervisor');

        // Fresh session (2h ago) — a genuine live clock-in.
        $live = $this->makeUser('recipient');
        $this->makeOpenLog($this->makeAssignment($live, $supervisor), $live, now()->subHours(2));

        // Stale session (15h ago) — a forgotten clock-out, not a live session.
        $stuck = $this->makeUser('recipient');
        $this->makeOpenLog($this->makeAssignment($stuck, $supervisor), $stuck, now()->subHours(15));

        Sanctum::actingAs($supervisor);
        $res = $this->getJson('/api/supervisor/students/clocked-in')->assertOk();

        $names = collect($res->json('data'))->pluck('user.name');
        $this->assertContains($live->name, $names);
        $this->assertNotContains($stuck->name, $names, 'A stale (>12h) open log must not appear as currently clocked in.');
    }

    public function test_reused_gps_coordinates_are_flagged(): void
    {
        $this->travelToValidClockIn();
        $recipient = $this->makeUser('recipient');
        $office = $this->makeGeofencedOffice();
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'), $office);

        // A prior log at the exact same coordinates — a real GPS never repeats exactly.
        TimeLog::create([
            'assignment_id' => $assignment->id, 'user_id' => $recipient->id,
            'date' => now()->subDay()->toDateString(), 'time_in' => now()->subDay(),
            'time_out' => now()->subDay()->addHours(2), 'status' => 'verified',
            'time_in_lat' => 8.0, 'time_in_lng' => 124.0,
        ]);

        Sanctum::actingAs($recipient);
        $this->postJson('/api/recipient/attendance/time-in-geofence', [
            'qr_token' => $this->qrForOffice($office), 'latitude' => 8.0, 'longitude' => 124.0,
        ])->assertStatus(201);

        $log = TimeLog::where('user_id', $recipient->id)->where('status', 'open')->first();
        $this->assertTrue((bool) $log->location_flagged);
        $this->assertStringContainsString('identical', (string) $log->location_flag_reason);
    }

    public function test_clock_in_selfie_is_stored_and_access_controlled(): void
    {
        Storage::fake('public');
        $this->travelToValidClockIn();
        $recipient = $this->makeUser('recipient');
        $supervisor = $this->makeUser('supervisor');
        $office = $this->makeGeofencedOffice();
        $this->makeAssignment($recipient, $supervisor, $office);

        Sanctum::actingAs($recipient);
        $this->post('/api/recipient/attendance/time-in-geofence', [
            'qr_token' => $this->qrForOffice($office), 'latitude' => 8.0, 'longitude' => 124.0,
            'photo' => UploadedFile::fake()->image('selfie.jpg'),
        ])->assertStatus(201);

        $log = TimeLog::where('user_id', $recipient->id)->first();
        $this->assertNotNull($log->time_in_photo_path);
        Storage::disk('public')->assertExists($log->time_in_photo_path);

        // The supervisor may view the selfie; an unrelated recipient may not.
        $supToken = $supervisor->createToken('t')->plainTextToken;
        $this->get("/api/attendance/{$log->id}/photo?token=" . urlencode($supToken))->assertOk();

        $stranger = $this->makeUser('recipient');
        $strangerToken = $stranger->createToken('t')->plainTextToken;
        $this->get("/api/attendance/{$log->id}/photo?token=" . urlencode($strangerToken))->assertStatus(403);
    }

    public function test_hours_summary_returns_expected_keys(): void
    {
        $recipient = $this->makeUser('recipient');
        $this->makeAssignment($recipient, $this->makeUser('supervisor'));

        Sanctum::actingAs($recipient);
        $this->getJson('/api/recipient/hours/summary')
            ->assertStatus(200)
            ->assertJsonStructure([
                'data' => ['required', 'rendered', 'verified', 'pending', 'rejected', 'remaining'],
            ]);
    }
}
