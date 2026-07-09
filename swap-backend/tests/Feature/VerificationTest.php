<?php

namespace Tests\Feature;

use App\Models\TimeLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

class VerificationTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function pendingLog($recipient, $supervisor): TimeLog
    {
        $assignment = $this->makeAssignment($recipient, $supervisor);
        $log = $this->makeOpenLog($assignment, $recipient, now()->subHours(3));
        $this->addNarrative($log);
        $log->update(['time_out' => now(), 'status' => 'pending_verification']);

        return $log->fresh();
    }

    public function test_assigned_supervisor_can_verify(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $log = $this->pendingLog($this->makeUser('recipient'), $supervisor);

        Sanctum::actingAs($supervisor);
        $this->putJson("/api/supervisor/verifications/{$log->id}", ['action' => 'verified'])
            ->assertStatus(200);

        $this->assertEquals('verified', $log->fresh()->status);
        $this->assertDatabaseHas('verifications', [
            'time_log_id' => $log->id, 'verified_by' => $supervisor->id, 'action' => 'verified',
        ]);
    }

    public function test_assigned_supervisor_can_reject_with_feedback(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $log = $this->pendingLog($this->makeUser('recipient'), $supervisor);

        Sanctum::actingAs($supervisor);
        $this->putJson("/api/supervisor/verifications/{$log->id}", [
            'action' => 'rejected', 'feedback' => 'Hours do not match the narrative.',
        ])->assertStatus(200);

        $this->assertEquals('rejected', $log->fresh()->status);
    }

    public function test_reject_without_feedback_is_rejected(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $log = $this->pendingLog($this->makeUser('recipient'), $supervisor);

        Sanctum::actingAs($supervisor);
        $this->putJson("/api/supervisor/verifications/{$log->id}", ['action' => 'rejected'])
            ->assertStatus(422)->assertJsonValidationErrors('feedback');
    }

    public function test_other_supervisor_cannot_verify_another_supervisors_log(): void
    {
        $owner = $this->makeUser('supervisor');
        $intruder = $this->makeUser('supervisor');
        $log = $this->pendingLog($this->makeUser('recipient'), $owner);

        Sanctum::actingAs($intruder);
        $this->putJson("/api/supervisor/verifications/{$log->id}", ['action' => 'verified'])
            ->assertStatus(403);

        $this->assertEquals('pending_verification', $log->fresh()->status);
    }

    public function test_bulk_verify_verifies_owned_pending_and_skips_others(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $mine1 = $this->pendingLog($this->makeUser('recipient'), $supervisor);
        $mine2 = $this->pendingLog($this->makeUser('recipient'), $supervisor);
        $other = $this->pendingLog($this->makeUser('recipient'), $this->makeUser('supervisor'));

        Sanctum::actingAs($supervisor);
        $res = $this->postJson('/api/supervisor/verifications/bulk', [
            'log_ids' => [$mine1->id, $mine2->id, $other->id],
        ]);

        $res->assertStatus(200)
            ->assertJsonPath('meta.verified', 2)
            ->assertJsonPath('meta.skipped', 1);

        $this->assertEquals('verified', $mine1->fresh()->status);
        $this->assertEquals('verified', $mine2->fresh()->status);
        $this->assertEquals('pending_verification', $other->fresh()->status);
    }

    public function test_bulk_verify_skips_location_flagged_logs(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $clean = $this->pendingLog($this->makeUser('recipient'), $supervisor);
        $flagged = $this->pendingLog($this->makeUser('recipient'), $supervisor);
        $flagged->update(['location_flagged' => true, 'location_flag_reason' => 'identical GPS coordinates reused']);

        Sanctum::actingAs($supervisor);
        $this->postJson('/api/supervisor/verifications/bulk', [
            'log_ids' => [$clean->id, $flagged->id],
        ])->assertStatus(200)
            ->assertJsonPath('meta.verified', 1)
            ->assertJsonPath('meta.skipped', 1);

        // A suspicious clock-in must be decided individually, never bulk-approved.
        $this->assertEquals('verified', $clean->fresh()->status);
        $this->assertEquals('pending_verification', $flagged->fresh()->status);
    }
}
