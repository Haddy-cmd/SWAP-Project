<?php

namespace Tests\Feature;

use App\Events\ApplicationApproved;
use App\Models\Application;
use App\Services\AssignmentService;
use App\Services\QrCodeService;
use App\Support\ApplicationTransitions;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function application($applicant, string $status = 'under_review'): Application
    {
        return Application::create([
            'user_id' => $applicant->id,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'status' => $status,
        ]);
    }

    public function test_admin_approves_application(): void
    {
        $applicant = $this->makeUser('applicant');
        // Approval is only permitted once an interview has been scheduled.
        $application = $this->application($applicant, 'interview_scheduled');

        Sanctum::actingAs($this->makeUser('admin'));
        $this->putJson("/api/admin/applications/{$application->id}/decide", [
            'decision' => 'approved',
        ])->assertStatus(200)->assertJsonPath('data.status', 'approved');

        $this->assertEquals('approved', $application->fresh()->status);
        $this->assertNotNull($application->fresh()->reviewed_by);
        $this->assertDatabaseHas('notifications', ['notifiable_id' => $applicant->id]);
    }

    public function test_admin_cannot_approve_without_scheduled_interview(): void
    {
        $application = $this->application($this->makeUser('applicant'), 'under_review');

        Sanctum::actingAs($this->makeUser('admin'));
        $this->putJson("/api/admin/applications/{$application->id}/decide", [
            'decision' => 'approved',
        ])->assertStatus(409);

        $this->assertEquals('under_review', $application->fresh()->status);
    }

    public function test_admin_can_reject_before_interview(): void
    {
        $application = $this->application($this->makeUser('applicant'), 'under_review');

        Sanctum::actingAs($this->makeUser('admin'));
        $this->putJson("/api/admin/applications/{$application->id}/decide", [
            'decision' => 'rejected',
            'remarks' => 'Did not meet the eligibility criteria.',
        ])->assertStatus(200)->assertJsonPath('data.status', 'rejected');

        $this->assertEquals('rejected', $application->fresh()->status);
    }

    public function test_admin_schedules_interview(): void
    {
        $application = $this->application($this->makeUser('applicant'));

        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson("/api/admin/applications/{$application->id}/interview", [
            'scheduled_at' => self::manilaSlot(3, 10)->toIso8601String(),
            'mode' => 'in_person',
            'location' => 'DSA Office',
        ])->assertStatus(200)->assertJsonPath('data.status', 'interview_scheduled');

        $this->assertDatabaseHas('interviews', ['application_id' => $application->id]);
    }

    public function test_a_decided_application_is_final(): void
    {
        $application = $this->application($this->makeUser('applicant'), 'approved');
        Sanctum::actingAs($this->makeUser('admin'));

        // Rejecting after approval would leave the recipient role + assignment behind.
        $this->putJson("/api/admin/applications/{$application->id}/decide", [
            'decision' => 'rejected', 'remarks' => 'Changed our mind.',
        ])->assertStatus(409)->assertJsonPath('message', ApplicationTransitions::MSG_DECIDED);

        $this->putJson("/api/admin/applications/{$application->id}/review")
            ->assertStatus(409)->assertJsonPath('message', ApplicationTransitions::MSG_DECIDED);

        $this->postJson("/api/admin/applications/{$application->id}/interview", [
            'scheduled_at' => self::manilaSlot(3, 10)->toIso8601String(),
            'mode' => 'in_person',
        ])->assertStatus(409)->assertJsonPath('message', ApplicationTransitions::MSG_DECIDED);

        $this->assertEquals('approved', $application->fresh()->status);
    }

    public function test_approval_is_refused_after_a_no_show(): void
    {
        $application = $this->application($this->makeUser('applicant'), 'interview_scheduled');
        $application->interview()->create([
            'scheduled_at' => now()->addDay(),
            'mode' => 'in_person',
            'location' => 'DSA Office',
            'status' => 'no_show',
        ]);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->putJson("/api/admin/applications/{$application->id}/decide", ['decision' => 'approved'])
            ->assertStatus(409)->assertJsonPath('message', ApplicationTransitions::MSG_NO_SHOW);

        // Rejection is still available.
        $this->putJson("/api/admin/applications/{$application->id}/decide", [
            'decision' => 'rejected', 'remarks' => 'Did not attend the interview.',
        ])->assertStatus(200);
    }

    public function test_review_only_moves_a_new_submission(): void
    {
        $application = $this->application($this->makeUser('applicant'), 'interview_scheduled');
        Sanctum::actingAs($this->makeUser('admin'));

        $this->putJson("/api/admin/applications/{$application->id}/review")
            ->assertStatus(409)->assertJsonPath('message', ApplicationTransitions::MSG_PAST_REVIEW);
        $this->assertEquals('interview_scheduled', $application->fresh()->status);
    }

    public function test_approval_succeeds_even_when_the_notification_fails(): void
    {
        $application = $this->application($this->makeUser('applicant'), 'interview_scheduled');
        Event::listen(ApplicationApproved::class, fn () => throw new \RuntimeException('SMTP connection refused'));
        Sanctum::actingAs($this->makeUser('admin'));

        $this->putJson("/api/admin/applications/{$application->id}/decide", ['decision' => 'approved'])
            ->assertStatus(200)->assertJsonPath('data.status', 'approved');
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

    public function test_a_second_active_assignment_for_the_same_term_is_refused(): void
    {
        $recipient = $this->makeUser('recipient');
        $supervisor = $this->makeUser('supervisor');
        $office = $this->makeOffice();
        $payload = [
            'user_id' => $recipient->id,
            'office_id' => $office->id,
            'supervisor_id' => $supervisor->id,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'required_hours' => 240,
            'start_date' => now()->toDateString(),
        ];

        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/assignments', $payload)->assertStatus(201);
        $this->postJson('/api/admin/assignments', $payload)
            ->assertStatus(422)
            ->assertJsonPath('errors.user_id.0', AssignmentService::MSG_ALREADY_ASSIGNED);

        $this->assertSame(1, \App\Models\Assignment::where('user_id', $recipient->id)->count());
    }

    public function test_the_database_rejects_a_duplicate_active_assignment(): void
    {
        $recipient = $this->makeUser('recipient');
        $supervisor = $this->makeUser('supervisor');
        $this->makeAssignment($recipient, $supervisor);

        $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);
        $this->makeAssignment($recipient, $supervisor);
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

    public function test_admin_deletes_user_cascades_relations_and_releases_email(): void
    {
        $applicant = $this->makeUser('applicant');
        $application = $this->application($applicant);
        $email = $applicant->email;

        Sanctum::actingAs($this->makeUser('admin'));
        $res = $this->deleteJson("/api/admin/users/{$applicant->id}");
        $res->assertStatus(200);

        $this->assertSoftDeleted('users', ['id' => $applicant->id]);
        $this->assertDatabaseMissing('users', ['email' => $email]);
        $this->assertDatabaseMissing('applications', ['id' => $application->id]);
    }
}
