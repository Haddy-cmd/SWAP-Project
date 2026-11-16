<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\ApplicationDocument;
use App\Models\Interview;
use App\Models\SemesterPeriod;
use App\Notifications\ApplicationReopenedNotification;
use App\Services\ApplicationService;
use App\Support\RejectionReasons;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** What happens to an applicant who was not approved: reason, reopening, and file retention. */
class RejectedApplicantTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function period(string $year, string $semester, int $startOffsetDays, int $endOffsetDays): SemesterPeriod
    {
        $today = Carbon::now('Asia/Manila')->startOfDay();

        return SemesterPeriod::create([
            'academic_year' => $year, 'semester' => $semester,
            'start_date' => $today->copy()->addDays($startOffsetDays)->toDateString(),
            'end_date' => $today->copy()->addDays($endOffsetDays)->toDateString(),
        ]);
    }

    private function application($user, string $status, array $attrs = []): Application
    {
        return Application::create($attrs + [
            'user_id' => $user->id,
            'academic_year' => '2026-2027',
            'semester' => '1st Semester',
            'status' => $status,
            'type' => 'new',
        ]);
    }

    private function withFile(Application $application, string $path = null): ApplicationDocument
    {
        $path ??= "documents/{$application->user_id}/cor-{$application->id}.pdf";
        Storage::disk('public')->put($path, 'pdf');

        return ApplicationDocument::create([
            'application_id' => $application->id, 'document_type' => 'cor',
            'file_path' => $path, 'file_url' => "/storage/{$path}", 'file_name' => 'cor.pdf',
            'file_size' => 3, 'mime_type' => 'application/pdf',
        ]);
    }

    private function reject(Application $application, array $body)
    {
        return $this->putJson("/api/admin/applications/{$application->id}/decide", ['decision' => 'rejected'] + $body);
    }

    // ── Reason ────────────────────────────────────────────────────────────

    public function test_rejecting_needs_a_reason_and_other_needs_a_note(): void
    {
        $application = $this->application($this->makeUser('applicant'), 'under_review');
        Sanctum::actingAs($this->makeUser('admin'));

        $this->reject($application, ['remarks' => 'sadasd'])->assertStatus(422)
            ->assertJsonValidationErrors(['rejection_reason' => RejectionReasons::MSG_REASON_REQUIRED]);
        $this->reject($application, ['rejection_reason' => 'other', 'remarks' => 'sadasd'])->assertStatus(422)
            ->assertJsonValidationErrors(['remarks' => RejectionReasons::MSG_NOTE_REQUIRED]);
        $this->assertSame('under_review', $application->fresh()->status);

        $this->reject($application, ['rejection_reason' => 'grade_requirement'])->assertOk()
            ->assertJsonPath('data.rejection_reason', 'grade_requirement')
            ->assertJsonPath('data.rejection_reason_label', 'Grade requirement not met');
        $this->assertDatabaseHas('notifications', ['notifiable_id' => $application->user_id]);
    }

    public function test_analytics_counts_rejection_reasons(): void
    {
        $this->application($this->makeUser('applicant'), 'rejected', ['rejection_reason' => 'no_slots']);
        $this->application($this->makeUser('applicant'), 'rejected', ['rejection_reason' => 'no_slots']);
        $this->application($this->makeUser('applicant'), 'rejected', ['rejection_reason' => 'missed_interview']);

        $reasons = app(\App\Services\AnalyticsService::class)->getAdminOverview(null, null)['rejection_reasons'];
        $this->assertSame([['no_slots', 2], ['missed_interview', 1]], array_map(fn ($r) => [$r['reason'], $r['count']], $reasons));
    }

    // ── Reopen ────────────────────────────────────────────────────────────

    public function test_admin_reopens_a_mistaken_rejection_back_to_its_interview(): void
    {
        Notification::fake();
        $this->period('2026-2027', '1st Semester', -10, 90);
        $applicant = $this->makeUser('applicant');
        $application = $this->application($applicant, 'interview_scheduled');
        Interview::create(['application_id' => $application->id, 'scheduled_at' => now()->addDay(), 'mode' => 'in_person', 'status' => 'scheduled']);
        Sanctum::actingAs($this->makeUser('admin'));
        $this->reject($application, ['rejection_reason' => 'missed_interview'])->assertOk();

        $this->putJson("/api/admin/applications/{$application->id}/reopen", ['reason' => 'short'])->assertStatus(422);
        $this->putJson("/api/admin/applications/{$application->id}/reopen", ['reason' => 'Rejected the wrong applicant.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'interview_scheduled')
            ->assertJsonPath('data.rejection_reason', null);

        $this->assertDatabaseHas('audit_logs', ['action' => 'application_reopened', 'auditable_id' => $application->id]);
        Notification::assertSentTo($applicant, ApplicationReopenedNotification::class);

        // Decided again normally afterwards.
        $this->putJson("/api/admin/applications/{$application->id}/decide", ['decision' => 'approved'])->assertOk();
    }

    public function test_reopen_is_refused_for_past_terms_renewals_and_other_open_applications(): void
    {
        $this->period('2026-2027', '2nd Semester', -10, 90);
        Sanctum::actingAs($this->makeUser('admin'));
        $reason = ['reason' => 'Rejected the wrong applicant.'];

        $past = $this->application($this->makeUser('applicant'), 'rejected');
        $this->putJson("/api/admin/applications/{$past->id}/reopen", $reason)
            ->assertStatus(409)->assertJsonPath('message', ApplicationService::MSG_REOPEN_PAST_TERM);

        $renewal = $this->application($this->makeUser('applicant'), 'rejected', ['semester' => '2nd Semester', 'type' => 'renewal']);
        $this->putJson("/api/admin/applications/{$renewal->id}/reopen", $reason)
            ->assertStatus(409)->assertJsonPath('message', ApplicationService::MSG_REOPEN_RENEWAL);

        $pending = $this->application($this->makeUser('applicant'), 'under_review', ['semester' => '2nd Semester']);
        $this->putJson("/api/admin/applications/{$pending->id}/reopen", $reason)
            ->assertStatus(409)->assertJsonPath('message', ApplicationService::MSG_REOPEN_NOT_REJECTED);
    }

    // ── File retention ────────────────────────────────────────────────────

    public function test_files_are_removed_once_a_newer_semester_starts(): void
    {
        Storage::fake('public');
        $this->period('2026-2027', '1st Semester', -150, -20);
        $this->period('2026-2027', '2nd Semester', -5, 120);

        $applicant = $this->makeUser('applicant');
        $old = $this->application($applicant, 'rejected', ['reviewed_at' => now()->subDays(60)]);
        $oldDoc = $this->withFile($old);
        // Rejected this semester: kept until the next one starts.
        $current = $this->application($this->makeUser('applicant'), 'rejected', ['semester' => '2nd Semester', 'reviewed_at' => now()]);
        $currentDoc = $this->withFile($current);
        // Renewals belong to a former recipient's record: never removed.
        $renewal = $this->application($this->makeUser('applicant'), 'rejected', ['type' => 'renewal', 'reviewed_at' => now()->subDays(60)]);
        $renewalDoc = $this->withFile($renewal);

        $this->artisan('applications:purge-rejected-documents')->assertSuccessful();

        Storage::disk('public')->assertMissing($oldDoc->file_path);
        $this->assertNotNull($oldDoc->fresh()->purged_at);
        Storage::disk('public')->assertExists($currentDoc->file_path);
        $this->assertNull($currentDoc->fresh()->purged_at);
        Storage::disk('public')->assertExists($renewalDoc->file_path);
        $this->assertDatabaseHas('audit_logs', ['action' => 'documents_purged', 'auditable_id' => $old->id]);

        // The record stays; opening the removed file says why.
        Sanctum::actingAs($applicant);
        $this->getJson("/api/applicant/applications/{$old->id}")->assertOk()
            ->assertJsonPath('data.status', 'rejected')
            ->assertJsonPath('data.documents.0.file_url', null);
        $token = $applicant->createToken('test')->plainTextToken;
        $this->getJson("/api/documents/{$oldDoc->id}/file?token=" . urlencode($token))->assertStatus(410);
    }

    public function test_without_a_newer_semester_files_go_after_five_months(): void
    {
        Storage::fake('public');
        $recent = $this->withFile($this->application($this->makeUser('applicant'), 'rejected', ['reviewed_at' => now()->subMonths(4)]));
        $old = $this->withFile($this->application($this->makeUser('applicant'), 'rejected', ['reviewed_at' => now()->subMonths(5)->subDay()]));

        $this->artisan('applications:purge-rejected-documents')->assertSuccessful();

        $this->assertNull($recent->fresh()->purged_at);
        $this->assertNotNull($old->fresh()->purged_at);
    }
}
