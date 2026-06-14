<?php

use App\Models\Assignment;
use App\Models\NarrativeReport;
use App\Models\TimeLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('supervisor can verify a pending log', function () {
    $supervisor = User::factory()->create(['role' => 'supervisor', 'is_active' => true]);
    $recipient = User::factory()->create(['role' => 'recipient']);

    $assignment = Assignment::factory()->create([
        'user_id' => $recipient->id,
        'supervisor_id' => $supervisor->id,
        'status' => 'active',
    ]);

    $log = TimeLog::factory()->create([
        'user_id' => $recipient->id,
        'assignment_id' => $assignment->id,
        'status' => 'pending_verification',
        'time_in' => now()->subHours(4),
        'time_out' => now(),
    ]);

    NarrativeReport::factory()->create(['time_log_id' => $log->id]);

    $this->actingAs($supervisor, 'sanctum')
        ->putJson("/api/supervisor/verifications/{$log->id}", ['action' => 'verified'])
        ->assertStatus(200)
        ->assertJson(['data' => ['status' => 'verified']]);
});

it('supervisor can reject a pending log with feedback', function () {
    $supervisor = User::factory()->create(['role' => 'supervisor', 'is_active' => true]);
    $recipient = User::factory()->create(['role' => 'recipient']);

    $assignment = Assignment::factory()->create([
        'user_id' => $recipient->id,
        'supervisor_id' => $supervisor->id,
    ]);

    $log = TimeLog::factory()->create([
        'user_id' => $recipient->id,
        'assignment_id' => $assignment->id,
        'status' => 'pending_verification',
        'time_in' => now()->subHours(4),
        'time_out' => now(),
    ]);

    $this->actingAs($supervisor, 'sanctum')
        ->putJson("/api/supervisor/verifications/{$log->id}", [
            'action' => 'rejected',
            'feedback' => 'Incomplete narrative report.',
        ])->assertStatus(200)
            ->assertJson(['data' => ['status' => 'rejected']]);
});

it('supervisor cannot verify logs of students not assigned to them', function () {
    $supervisor = User::factory()->create(['role' => 'supervisor', 'is_active' => true]);
    $otherSupervisor = User::factory()->create(['role' => 'supervisor']);
    $recipient = User::factory()->create(['role' => 'recipient']);

    $assignment = Assignment::factory()->create([
        'user_id' => $recipient->id,
        'supervisor_id' => $otherSupervisor->id,
    ]);

    $log = TimeLog::factory()->create([
        'user_id' => $recipient->id,
        'assignment_id' => $assignment->id,
        'status' => 'pending_verification',
        'time_in' => now()->subHours(4),
        'time_out' => now(),
    ]);

    $this->actingAs($supervisor, 'sanctum')
        ->putJson("/api/supervisor/verifications/{$log->id}", ['action' => 'verified'])
        ->assertStatus(403);
});
