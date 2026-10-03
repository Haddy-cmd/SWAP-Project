<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\TermReport;
use App\Models\User;
use App\Notifications\TermReportReviewedNotification;
use App\Notifications\TermReportSubmittedNotification;
use App\Services\TermReportReviewService;
use App\Services\TermReportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** The supervisor accepts the end-of-term report and marks the student eligible or not for renewal. */
class TermReportReviewTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    /** @return array{0: User, 1: User, 2: Assignment} supervisor, student, placement */
    private function placement(): array
    {
        $supervisor = $this->makeSupervisorWithoutSelfie();
        $student = $this->makeUser('recipient');

        return [$supervisor, $student, $this->makeAssignment($student, $supervisor)];
    }

    private function review(Assignment $assignment, bool $eligible, ?string $remarks = null)
    {
        return $this->putJson("/api/supervisor/assignments/{$assignment->id}/term-report/review", [
            'renewal_eligible' => $eligible, 'remarks' => $remarks,
        ]);
    }

    public function test_the_supervisor_accepts_the_report_with_a_renewal_mark(): void
    {
        Notification::fake();
        [$supervisor, $student, $assignment] = $this->placement();

        // Submitting tells the supervisor; nothing to accept before that.
        Sanctum::actingAs($supervisor);
        $this->review($assignment, true)->assertStatus(422)->assertJsonPath('message', TermReportReviewService::MSG_NOT_SUBMITTED);
        Sanctum::actingAs($student);
        $this->putJson('/api/recipient/term-report', ['content' => str_repeat('Assisted the office with records and queries. ', 3)])->assertOk();
        Notification::assertSentTo($supervisor, TermReportSubmittedNotification::class);

        Sanctum::actingAs($supervisor);
        $this->getJson('/api/supervisor/students')->assertOk()
            ->assertJsonPath('data.0.report_to_review', true)
            ->assertJsonPath('data.0.term_report.reviewed_at', null);

        $this->review($assignment, false, 'Missed several duty days.')->assertOk()
            ->assertJsonPath('message', 'Report accepted. The student is marked not eligible for renewal.')
            ->assertJsonPath('data.renewal_eligible', false)
            ->assertJsonPath('data.review_remarks', 'Missed several duty days.')
            ->assertJsonPath('data.reviewer', $supervisor->name);
        Notification::assertSentTo($student, TermReportReviewedNotification::class, fn ($n) =>
            $n->toArray($student)['message'] === 'Your supervisor accepted your end-of-term report for 1st Semester 2024-2025 and marked you not eligible for renewal.');

        // The mark can be changed while the placement is current.
        $this->review($assignment, true)->assertOk()->assertJsonPath('data.renewal_eligible', true);
        $this->getJson('/api/supervisor/students')->assertJsonPath('data.0.report_to_review', false)
            ->assertJsonPath('data.0.term_report.renewal_eligible', true);
        $this->getJson("/api/supervisor/students/{$student->id}/summary")->assertOk()
            ->assertJsonPath('term_report.renewal_eligible', true)
            ->assertJsonPath('hours_met', false);
        $this->assertDatabaseHas('audit_logs', ['action' => 'term_report_reviewed', 'user_id' => $supervisor->id]);

        // Once accepted, the student can't edit it any more.
        Sanctum::actingAs($student);
        $this->getJson('/api/recipient/term-report')->assertOk()->assertJsonPath('meta.editable', false);
        $this->putJson('/api/recipient/term-report', ['content' => str_repeat('Rewritten after acceptance, which is not allowed. ', 3)])
            ->assertStatus(422)->assertJsonPath('message', TermReportService::MSG_ACCEPTED);
    }

    public function test_only_the_placements_supervisors_review_and_only_while_it_is_current(): void
    {
        [, $student, $assignment] = $this->placement();
        $this->submitTermReport($assignment);

        Sanctum::actingAs($this->makeSupervisorWithoutSelfie());
        $this->review($assignment, true)->assertStatus(404);
        Sanctum::actingAs($student);
        $this->review($assignment, true)->assertStatus(403);

        Sanctum::actingAs(User::find($assignment->supervisor_id));
        $this->putJson("/api/supervisor/assignments/{$assignment->id}/term-report/review", [])->assertStatus(422)
            ->assertJsonPath('errors.renewal_eligible.0', 'Choose whether the student is eligible for renewal.');
        $assignment->update(['status' => 'completed']);
        $this->review($assignment, true)->assertStatus(422)->assertJsonPath('message', TermReportReviewService::MSG_NOT_ACTIVE);
        $this->assertNull(TermReport::where('assignment_id', $assignment->id)->first()->reviewed_at);
    }
}
