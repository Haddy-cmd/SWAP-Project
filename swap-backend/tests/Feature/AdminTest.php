<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Services\QrCodeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function application($applicant): Application
    {
        return Application::create([
            'user_id' => $applicant->id,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'status' => 'under_review',
        ]);
    }

    public function test_admin_approves_application(): void
    {
        $applicant = $this->makeUser('applicant');
        $application = $this->application($applicant);

        Sanctum::actingAs($this->makeUser('admin'));
        $this->putJson("/api/admin/applications/{$application->id}/decide", [
            'decision' => 'approved',
        ])->assertStatus(200)->assertJsonPath('data.status', 'approved');

        $this->assertEquals('approved', $application->fresh()->status);
        $this->assertNotNull($application->fresh()->reviewed_by);
        $this->assertDatabaseHas('notifications', ['notifiable_id' => $applicant->id]);
    }

    public function test_admin_schedules_interview(): void
    {
        $application = $this->application($this->makeUser('applicant'));

        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson("/api/admin/applications/{$application->id}/interview", [
            'scheduled_at' => now()->addDays(3)->toIso8601String(),
            'mode' => 'in_person',
            'location' => 'DSA Office',
        ])->assertStatus(200)->assertJsonPath('data.status', 'interview_scheduled');

        $this->assertDatabaseHas('interviews', ['application_id' => $application->id]);
    }

    public function test_admin_creates_assignment_with_qr(): void
    {
        $recipient = $this->makeUser('recipient');
        $supervisor = $this->makeUser('supervisor');
        $office = $this->makeOffice();

        Sanctum::actingAs($this->makeUser('admin'));
        $res = $this->postJson('/api/admin/assignments', [
            'user_id' => $recipient->id,
            'office_id' => $office->id,
            'supervisor_id' => $supervisor->id,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'required_hours' => 240,
            'start_date' => now()->toDateString(),
        ]);

        $res->assertStatus(201);
        $this->assertNotEmpty($res->json('data.qr_code'));
        $this->assertDatabaseHas('assignments', ['user_id' => $recipient->id, 'office_id' => $office->id]);
    }

    public function test_regenerate_qr_invalidates_old_token(): void
    {
        $assignment = $this->makeAssignment($this->makeUser('recipient'), $this->makeUser('supervisor'));
        $oldToken = app(QrCodeService::class)->generateForAssignment($assignment);

        Sanctum::actingAs($this->makeUser('admin'));
        $res = $this->postJson("/api/admin/assignments/{$assignment->id}/regenerate-qr");

        $res->assertStatus(200);
        $newToken = $res->json('data.qr_code');

        $this->assertNotEquals($oldToken, $newToken);
        $this->assertNull(app(QrCodeService::class)->validate($oldToken));
    }
}
