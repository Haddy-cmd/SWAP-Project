<?php

use App\Models\Assignment;
use App\Models\TimeLog;
use App\Models\User;
use App\Services\QrCodeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function createRecipientWithAssignment(): array
{
    $supervisor = User::factory()->create(['role' => 'supervisor']);
    $recipient = User::factory()->create(['role' => 'recipient', 'is_active' => true]);

    $assignment = Assignment::factory()->create([
        'user_id' => $recipient->id,
        'supervisor_id' => $supervisor->id,
        'status' => 'active',
        'qr_secret' => Str::random(64),
    ]);

    $token = app(QrCodeService::class)->generateForAssignment($assignment);

    return compact('recipient', 'assignment', 'token');
}

it('recipient can time in with valid QR token', function () {
    ['recipient' => $recipient, 'token' => $token] = createRecipientWithAssignment();

    $this->actingAs($recipient, 'sanctum')
        ->postJson('/api/recipient/attendance/time-in', ['qr_token' => $token])
        ->assertStatus(201)
        ->assertJsonStructure(['data' => ['id', 'status', 'time_in']]);

    expect(TimeLog::where('user_id', $recipient->id)->where('status', 'open')->exists())->toBeTrue();
});

it('rejects time-in if open log already exists today', function () {
    ['recipient' => $recipient, 'assignment' => $assignment, 'token' => $token] = createRecipientWithAssignment();

    TimeLog::factory()->create([
        'user_id' => $recipient->id,
        'assignment_id' => $assignment->id,
        'status' => 'open',
        'date' => now()->toDateString(),
        'time_in' => now(),
    ]);

    $this->actingAs($recipient, 'sanctum')
        ->postJson('/api/recipient/attendance/time-in', ['qr_token' => $token])
        ->assertStatus(409);
});

it('rejects time-out without narrative report', function () {
    ['recipient' => $recipient, 'assignment' => $assignment, 'token' => $token] = createRecipientWithAssignment();

    $log = TimeLog::factory()->create([
        'user_id' => $recipient->id,
        'assignment_id' => $assignment->id,
        'status' => 'open',
        'date' => now()->toDateString(),
        'time_in' => now()->subHour(),
    ]);

    $this->actingAs($recipient, 'sanctum')
        ->postJson('/api/recipient/attendance/time-out', [
            'log_id' => $log->id,
            'qr_token' => $token,
        ])->assertStatus(422)
            ->assertJson(['message' => 'Please submit your narrative report before clocking out.']);
});

it('rejects time-in with invalid QR token', function () {
    ['recipient' => $recipient] = createRecipientWithAssignment();

    $this->actingAs($recipient, 'sanctum')
        ->postJson('/api/recipient/attendance/time-in', ['qr_token' => 'tampered.token'])
        ->assertStatus(422);
});
