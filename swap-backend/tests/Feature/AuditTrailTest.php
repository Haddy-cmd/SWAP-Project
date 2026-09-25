<?php

namespace Tests\Feature;

use App\Models\TimeLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * Mutations that used to leave no audit_logs row (audit R12). One assertion per
 * area: who did what, to which record.
 */
class AuditTrailTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function assertAudited(string $action, string $type, int $id, ?int $userId = null): void
    {
        $this->assertDatabaseHas('audit_logs', array_filter([
            'action' => $action,
            'auditable_type' => $type,
            'auditable_id' => $id,
            'user_id' => $userId,
        ], fn ($v) => $v !== null));
    }

    public function test_clock_in_and_clock_out_are_audited(): void
    {
        $this->travelTo(Carbon::create(2026, 7, 6, 9, 0, 0, 'Asia/Manila'));
        $recipient = $this->makeUser('recipient');
        $office = $this->makeGeofencedOffice();
        $this->makeAssignment($recipient, $this->makeSupervisorWithoutSelfie(), $office);

        Sanctum::actingAs($recipient);
        $logId = $this->postJson('/api/recipient/attendance/time-in-geofence', [
            'qr_token' => $this->qrForOffice($office), 'latitude' => 8.0, 'longitude' => 124.0, 'accuracy' => 10,
        ])->assertStatus(201)->json('data.id');

        $this->assertAudited('clocked_in', TimeLog::class, $logId, $recipient->id);

        $this->travel(2)->hours();
        $this->postJson('/api/recipient/attendance/auto-clock-out', [
            'log_id' => $logId, 'latitude' => 8.01, 'longitude' => 124.0, 'accuracy' => 10,
        ])->assertOk();

        $this->assertAudited('clocked_out', TimeLog::class, $logId, $recipient->id);
    }

    public function test_supervisor_bonus_hours_and_required_hours_changes_are_audited(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $supervisor);

        Sanctum::actingAs($supervisor);
        $logId = $this->postJson("/api/supervisor/students/{$recipient->id}/manual-hours", [
            'hours' => 2, 'date' => now()->toDateString(), 'reason' => 'Event duty',
        ])->assertStatus(201)->json('data.id');
        $this->assertAudited('manual_hours_added', TimeLog::class, $logId, $supervisor->id);

        $this->putJson("/api/supervisor/students/{$recipient->id}/required-hours", ['required_hours' => 200])->assertOk();
        $this->assertAudited('updated', \App\Models\Assignment::class, $assignment->id, $supervisor->id);
    }

    public function test_profile_signature_and_password_changes_are_audited(): void
    {
        $user = $this->makeUser('supervisor');
        $token = $user->createToken('auth_token')->plainTextToken;
        $otherSession = $user->createToken('auth_token')->plainTextToken;

        $this->withToken($token)->putJson('/api/profile', ['name' => 'Renamed Supervisor'])->assertOk();
        $this->assertAudited('profile_updated', User::class, $user->id, $user->id);

        $this->withToken($token)->deleteJson('/api/profile/signature')->assertOk();
        $this->assertAudited('signature_removed', User::class, $user->id, $user->id);

        $this->withToken($token)->putJson('/api/profile/password', [
            'current_password' => 'Password@123',
            'password' => 'NewPassword@456',
            'password_confirmation' => 'NewPassword@456',
        ])->assertOk();
        $this->assertAudited('password_changed', User::class, $user->id, $user->id);

        // The other session is signed out; the one that changed the password stays.
        $this->assertSame(1, $user->tokens()->count());
        $this->app['auth']->forgetGuards();
        $this->withToken($otherSession)->getJson('/api/profile')->assertStatus(401);
    }

    public function test_report_exports_are_audited(): void
    {
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);

        $this->get('/api/admin/reports/generate?type=stipend&academic_year=2024-2025&semester=1st%20Semester')
            ->assertOk();

        $this->assertAudited('report_exported', User::class, $admin->id, $admin->id);
    }
}
