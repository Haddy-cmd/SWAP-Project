<?php

namespace Tests\Feature;

use App\Models\TimeLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

class AttendanceTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_time_in_with_valid_qr_opens_a_log(): void
    {
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'));
        $token = $this->qrFor($assignment);

        Sanctum::actingAs($recipient);
        $res = $this->postJson('/api/recipient/attendance/time-in', ['qr_token' => $token]);

        $res->assertStatus(201)->assertJsonPath('data.status', 'open');
        $this->assertNull($res->json('data.time_out'));
        $this->assertDatabaseHas('time_logs', [
            'user_id' => $recipient->id, 'assignment_id' => $assignment->id, 'status' => 'open',
        ]);
    }

    public function test_second_time_in_same_day_conflicts(): void
    {
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'));
        $token = $this->qrFor($assignment);

        Sanctum::actingAs($recipient);
        $this->postJson('/api/recipient/attendance/time-in', ['qr_token' => $token])->assertStatus(201);
        $this->postJson('/api/recipient/attendance/time-in', ['qr_token' => $token])->assertStatus(409);
    }

    public function test_time_in_with_tampered_qr_is_rejected(): void
    {
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'));
        $token = $this->qrFor($assignment);
        $tampered = substr($token, 0, -1).'X';

        Sanctum::actingAs($recipient);
        $this->postJson('/api/recipient/attendance/time-in', ['qr_token' => $tampered])->assertStatus(422);
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
