<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\SemesterPeriod;
use App\Models\User;
use App\Notifications\AnnouncementNotification;
use App\Notifications\ApplicationApprovedNotification;
use App\Notifications\OfficeAssignmentNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * Approving an application makes the student a recipient right away (2026-10-05), before
 * any office assignment, so DSA announcements reach them while they wait to be placed.
 */
class ApprovalMakesRecipientTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function application(User $applicant, string $status = 'interview_scheduled', string $type = 'new', array $attrs = []): Application
    {
        return Application::create(array_merge([
            'user_id' => $applicant->id,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'status' => $status,
            'type' => $type,
        ], $attrs));
    }

    public function test_approval_makes_the_student_a_recipient_before_any_office(): void
    {
        Notification::fake();
        $applicant = $this->makeUser('applicant');
        $application = $this->application($applicant);
        $admin = $this->makeUser('admin');

        Sanctum::actingAs($admin);
        $this->putJson("/api/admin/applications/{$application->id}/decide", ['decision' => 'approved'])
            ->assertOk()->assertJsonPath('data.status', 'approved');

        $this->assertSame('recipient', $applicant->fresh()->role);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'promoted_to_recipient', 'auditable_id' => $applicant->id, 'user_id' => $admin->id,
        ]);
        Notification::assertSentTo($applicant, ApplicationApprovedNotification::class, function ($n) use ($applicant) {
            $mail = $n->toMail($applicant);

            return in_array('You are now a SWAP recipient: announcements from the DSA reach you in the portal and by email.', $mail->introLines, true)
                && str_ends_with($mail->actionUrl, '/recipient/dashboard');
        });

        // Still waiting in the Assignments queue (it lists approved applications).
        $this->getJson('/api/admin/applications?status=approved')->assertOk()
            ->assertJsonFragment(['user_id' => $applicant->id]);
    }

    public function test_an_approved_student_without_an_office_gets_announcements(): void
    {
        Notification::fake();
        Mail::fake();
        $waiting = $this->makeUser('applicant');
        $this->application($waiting);
        $stillApplying = $this->makeUser('applicant');
        $this->application($stillApplying, 'under_review');
        Sanctum::actingAs($this->makeUser('admin'));
        $this->putJson('/api/admin/applications/'.Application::firstWhere('user_id', $waiting->id)->id.'/decide', ['decision' => 'approved'])
            ->assertOk();

        $this->getJson('/api/admin/announcements')->assertOk()->assertJsonPath('meta.active_recipients', 1);
        $this->postJson('/api/admin/announcements', ['title' => 'Orientation', 'message' => 'See you at the DSA Office.'])
            ->assertSuccessful();

        Notification::assertSentTo($waiting, AnnouncementNotification::class);
        Notification::assertNotSentTo($stillApplying, AnnouncementNotification::class);
    }

    public function test_the_recipient_portal_works_before_the_office_is_assigned(): void
    {
        Storage::fake(config('filesystems.documents_disk', 'public'));
        $student = $this->makeUser('applicant');
        // Approved for the term that is also open for renewal.
        $this->application($student, 'interview_scheduled', 'new', ['academic_year' => '2026-2027', 'semester' => '2nd Semester']);
        SemesterPeriod::create([
            'academic_year' => '2026-2027', 'semester' => '2nd Semester',
            'start_date' => now()->addMonth()->toDateString(), 'end_date' => now()->addMonths(5)->toDateString(),
            'renewal_open' => true,
        ]);
        Sanctum::actingAs($this->makeUser('admin'));
        $this->putJson('/api/admin/applications/'.Application::firstWhere('user_id', $student->id)->id.'/decide', ['decision' => 'approved'])
            ->assertOk();

        Sanctum::actingAs($student->fresh());
        $this->getJson('/api/recipient/assignment')->assertOk()->assertJsonPath('data', null);
        $this->getJson('/api/recipient/hours/summary')->assertOk();
        $this->getJson('/api/recipient/stipend/history')->assertOk()->assertJsonCount(0, 'data');
        // Their own approved application is not a renewal, and they have no term to renew.
        $this->getJson('/api/recipient/renewals')->assertOk()->assertJsonPath('data', null);
        $this->post('/api/recipient/renewals', ['cor' => UploadedFile::fake()->create('cor.pdf', 100, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('message', 'Renewal is only available to recipients with an existing assignment.');
        // The applicant pages are closed now.
        $this->getJson('/api/applicant/applications')->assertForbidden();
    }

    public function test_placing_an_approved_recipient_keeps_the_role_and_notifies(): void
    {
        Notification::fake();
        $student = $this->makeUser('applicant');
        $this->application($student);
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);
        $this->putJson('/api/admin/applications/'.Application::firstWhere('user_id', $student->id)->id.'/decide', ['decision' => 'approved'])
            ->assertOk();

        $this->postJson('/api/admin/assignments', [
            'user_id' => $student->id,
            'office_id' => $this->makeOffice()->id,
            'supervisor_id' => $this->makeUser('supervisor')->id,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'required_hours' => 200,
            'start_date' => now()->toDateString(),
        ])->assertCreated();

        $this->assertSame('recipient', $student->fresh()->role);
        Notification::assertSentTo($student, OfficeAssignmentNotification::class);
    }

    public function test_rejection_and_renewal_approval_leave_the_role_alone(): void
    {
        $rejected = $this->makeUser('applicant');
        $application = $this->application($rejected, 'under_review');
        Sanctum::actingAs($this->makeUser('admin'));

        $this->putJson("/api/admin/applications/{$application->id}/decide", ['decision' => 'rejected', 'remarks' => 'Incomplete documents.'])
            ->assertOk();

        $this->assertSame('applicant', $rejected->fresh()->role);
        $this->assertDatabaseMissing('audit_logs', ['action' => 'promoted_to_recipient', 'auditable_id' => $rejected->id]);
    }

    public function test_the_migration_promotes_approved_students_still_waiting(): void
    {
        $waiting = $this->makeUser('applicant');
        $this->application($waiting, 'approved');
        $inReview = $this->makeUser('applicant');
        $this->application($inReview, 'under_review');
        // Approved once, later returned to the applicant portal by a rejected renewal.
        $returned = $this->makeUser('applicant');
        $this->application($returned, 'approved');
        $this->application($returned, 'rejected', 'renewal', ['semester' => '2nd Semester']);
        $neverApplied = $this->makeUser('applicant');

        $migration = require database_path('migrations/2026_10_05_000005_promote_approved_applicants_to_recipients.php');
        $migration->up();

        $this->assertSame('recipient', $waiting->fresh()->role);
        $this->assertSame('applicant', $inReview->fresh()->role);
        $this->assertSame('applicant', $returned->fresh()->role);
        $this->assertSame('applicant', $neverApplied->fresh()->role);
        $this->assertDatabaseHas('audit_logs', ['action' => 'promoted_to_recipient', 'auditable_id' => $waiting->id, 'user_id' => null]);

        // Running it again changes nothing.
        $migration->up();
        $this->assertSame(1, \App\Models\AuditLog::where('action', 'promoted_to_recipient')->count());
    }
}
