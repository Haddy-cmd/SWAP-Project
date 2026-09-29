<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\AuditLog;
use App\Models\OrientationSession;
use App\Models\User;
use App\Notifications\OrientationInvitationNotification;
use App\Services\OrientationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * The orientation step: sessions, invitations, attendance, and the placement gate
 * (a new applicant must have attended, unless the admin places them anyway).
 */
class OrientationTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function approvedApplicant(): User
    {
        $applicant = $this->makeUser('applicant');
        Application::create([
            'user_id' => $applicant->id,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'status' => 'approved',
        ]);

        return $applicant;
    }

    private function sessionPayload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'SWAP Orientation — Batch 1',
            'scheduled_at' => now()->addDays(3)->toIso8601String(),
            'mode' => 'in_person',
            'location' => 'DSA Conference Room',
        ], $overrides);
    }

    private function makeSession(User $admin): OrientationSession
    {
        Sanctum::actingAs($admin);
        $id = $this->postJson('/api/admin/orientation/sessions', $this->sessionPayload())
            ->assertStatus(201)->json('data.id');

        return OrientationSession::findOrFail($id);
    }

    private function placementPayload(User $user, array $overrides = []): array
    {
        return array_merge([
            'user_id' => $user->id,
            'office_id' => $this->makeOffice()->id,
            'supervisor_id' => $this->makeUser('supervisor')->id,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'required_hours' => 240,
            'start_date' => now()->toDateString(),
        ], $overrides);
    }

    public function test_admin_creates_a_session_and_the_venue_rules_apply(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/orientation/sessions', $this->sessionPayload(['location' => null]))
            ->assertStatus(422)->assertJsonPath('errors.location.0', 'An in-person orientation needs a venue.');
        $this->postJson('/api/admin/orientation/sessions', $this->sessionPayload(['mode' => 'online', 'location' => null]))
            ->assertStatus(422)->assertJsonPath('errors.meeting_link.0', 'An online orientation needs a meeting link.');
        $this->postJson('/api/admin/orientation/sessions', $this->sessionPayload(['scheduled_at' => now()->subDay()->toIso8601String()]))
            ->assertStatus(422)->assertJsonPath('errors.scheduled_at.0', 'Pick a date and time in the future.');

        $this->postJson('/api/admin/orientation/sessions', $this->sessionPayload())
            ->assertStatus(201)
            ->assertJsonPath('data.location', 'DSA Conference Room')
            ->assertJsonPath('data.attendees', []);

        $this->assertDatabaseHas('audit_logs', ['action' => 'orientation_created']);
    }

    public function test_inviting_notifies_only_approved_unplaced_applicants_once(): void
    {
        Notification::fake();
        $admin = $this->makeUser('admin');
        $a = $this->approvedApplicant();
        $b = $this->approvedApplicant();
        $pending = $this->makeUser('applicant'); // no approved application
        $session = $this->makeSession($admin);

        // Everyone eligible by default.
        $this->postJson("/api/admin/orientation/sessions/{$session->id}/invite", [])
            ->assertStatus(200)->assertJsonPath('meta.invited', 2);

        Notification::assertSentTo([$a, $b], OrientationInvitationNotification::class);
        Notification::assertNotSentTo($pending, OrientationInvitationNotification::class);
        $this->assertDatabaseHas('orientation_attendees', ['orientation_session_id' => $session->id, 'user_id' => $a->id, 'status' => 'invited']);

        // Re-inviting sends nothing new.
        $this->postJson("/api/admin/orientation/sessions/{$session->id}/invite", ['user_ids' => [$a->id]])
            ->assertStatus(200)->assertJsonPath('meta.invited', 0)
            ->assertJsonPath('message', 'Everyone selected is already invited to this session.');
        Notification::assertSentToTimes($a, OrientationInvitationNotification::class, 1);

        // Someone who is not a candidate cannot be invited.
        $this->postJson("/api/admin/orientation/sessions/{$session->id}/invite", ['user_ids' => [$pending->id]])
            ->assertStatus(422)->assertJsonPath('message', OrientationService::MSG_NOT_CANDIDATE);
    }

    public function test_attendance_is_marked_audited_and_shows_in_candidates(): void
    {
        $admin = $this->makeUser('admin');
        $applicant = $this->approvedApplicant();
        $session = $this->makeSession($admin);
        $this->postJson("/api/admin/orientation/sessions/{$session->id}/invite", ['user_ids' => [$applicant->id]])->assertOk();

        $this->getJson('/api/admin/orientation/candidates')
            ->assertOk()->assertJsonPath('data.0.orientation_status', 'invited');

        $this->putJson("/api/admin/orientation/sessions/{$session->id}/attendance", ['user_id' => $applicant->id, 'status' => 'attended'])
            ->assertOk()->assertJsonPath('data.attendees.0.status', 'attended');

        $this->getJson('/api/admin/orientation/candidates')
            ->assertOk()
            ->assertJsonPath('data.0.orientation_status', 'attended')
            ->assertJsonPath('data.0.session_title', 'SWAP Orientation — Batch 1');
        $this->assertDatabaseHas('audit_logs', ['action' => 'orientation_attendance_marked', 'user_id' => $admin->id]);

        // A session with recorded attendance can't be deleted.
        $this->deleteJson("/api/admin/orientation/sessions/{$session->id}")
            ->assertStatus(422)->assertJsonPath('message', OrientationService::MSG_HAS_ATTENDANCE);
    }

    public function test_placement_is_blocked_until_the_applicant_attends(): void
    {
        $admin = $this->makeUser('admin');
        $applicant = $this->approvedApplicant();
        $session = $this->makeSession($admin);

        $this->postJson('/api/admin/assignments', $this->placementPayload($applicant))
            ->assertStatus(422)->assertJsonPath('errors.user_id.0', OrientationService::MSG_NOT_ORIENTED);

        // Absent doesn't count.
        $this->putJson("/api/admin/orientation/sessions/{$session->id}/attendance", ['user_id' => $applicant->id, 'status' => 'absent'])->assertOk();
        $this->postJson('/api/admin/assignments', $this->placementPayload($applicant))->assertStatus(422);

        $this->putJson("/api/admin/orientation/sessions/{$session->id}/attendance", ['user_id' => $applicant->id, 'status' => 'attended'])->assertOk();
        $this->postJson('/api/admin/assignments', $this->placementPayload($applicant))->assertStatus(201);

        $this->assertSame('recipient', $applicant->fresh()->role);
    }

    public function test_place_anyway_overrides_the_gate_and_is_audited(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $applicant = $this->approvedApplicant();

        $res = $this->postJson('/api/admin/assignments', $this->placementPayload($applicant, ['skip_orientation' => true]))
            ->assertStatus(201);

        $log = AuditLog::where('action', 'created')->where('auditable_id', $res->json('data.id'))->firstOrFail();
        $this->assertTrue($log->new_values['skip_orientation'] ?? false);
    }

    public function test_renewing_recipients_are_exempt(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $recipient = $this->makeUser('recipient'); // placed before: came back through renewal

        $this->postJson('/api/admin/assignments', $this->placementPayload($recipient, ['semester' => '2nd Semester']))
            ->assertStatus(201);
    }

    public function test_the_applicant_sees_their_invitation(): void
    {
        $admin = $this->makeUser('admin');
        $applicant = $this->approvedApplicant();
        $session = $this->makeSession($admin);
        $this->postJson("/api/admin/orientation/sessions/{$session->id}/invite", ['user_ids' => [$applicant->id]])->assertOk();

        Sanctum::actingAs($applicant);
        $this->getJson('/api/applicant/orientation')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'SWAP Orientation — Batch 1')
            ->assertJsonPath('data.0.location', 'DSA Conference Room')
            ->assertJsonPath('data.0.status', 'invited');
    }

    public function test_non_admins_cannot_manage_orientation(): void
    {
        foreach (['applicant', 'recipient', 'supervisor'] as $role) {
            Sanctum::actingAs($this->makeUser($role));
            $this->getJson('/api/admin/orientation/sessions')->assertStatus(403);
            $this->postJson('/api/admin/orientation/sessions', $this->sessionPayload())->assertStatus(403);
        }
    }
}
