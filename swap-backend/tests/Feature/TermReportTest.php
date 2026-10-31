<?php

namespace Tests\Feature;

use App\Models\PromissoryNote;
use App\Models\StipendHistory;
use App\Services\TermReportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * The end-of-term narrative report: written and edited by the recipient until
 * their stipend is released, read by the supervisor, required for payout.
 */
class TermReportTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function report(array $overrides = []): array
    {
        return array_merge([
            'content' => str_repeat('I assisted the office with filing, encoding and front-desk duties this term. ', 2),
            'accomplishments' => 'Digitized the 2023 records.',
            'challenges' => null,
        ], $overrides);
    }

    public function test_the_report_opens_only_after_the_semester_ends(): void
    {
        $recipient = $this->makeUser('recipient');
        $end = Carbon::today()->addWeeks(3);
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'), null, ['required_hours' => 10, 'end_date' => $end->toDateString()]);
        $this->makeClosedLog($assignment, 10); // hours done early: still locked
        Sanctum::actingAs($recipient);

        $msg = 'You can submit your end-of-term report after the semester ends on ' . $end->format('M j, Y') . '.';
        $this->getJson('/api/recipient/term-report')->assertOk()
            ->assertJsonPath('meta.can_submit', false)->assertJsonPath('meta.submit_block', $msg);
        $this->putJson('/api/recipient/term-report', $this->report())->assertStatus(422)->assertJsonPath('message', $msg);
        $this->assertSame(0, $assignment->termReport()->count());

        // Ended with the hours done: open.
        $assignment->update(['end_date' => Carbon::yesterday()->toDateString()]);
        $this->getJson('/api/recipient/term-report')->assertJsonPath('meta.can_submit', true)->assertJsonPath('meta.submit_block', null);
        $this->putJson('/api/recipient/term-report', $this->report())->assertOk();
    }

    public function test_short_on_hours_needs_a_promissory_note_first(): void
    {
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'), null, [
            'required_hours' => 200, 'start_date' => Carbon::today()->subDays(120)->toDateString(), 'end_date' => Carbon::yesterday()->toDateString(),
        ]);
        $this->makeClosedLog($assignment, 187.5);
        Sanctum::actingAs($recipient);

        $msg = "You're 12.5h short of the 200 required hours. File a promissory note on the Stipend page first, then submit your report.";
        $this->getJson('/api/recipient/term-report')->assertJsonPath('meta.can_submit', false)->assertJsonPath('meta.submit_block', $msg);
        $this->putJson('/api/recipient/term-report', $this->report())->assertStatus(422)->assertJsonPath('message', $msg);

        // A filed (still pending) promissory note is enough.
        PromissoryNote::create(['assignment_id' => $assignment->id, 'user_id' => $recipient->id, 'academic_year' => $assignment->academic_year,
            'semester' => $assignment->semester, 'verified_hours_snapshot' => 187.5, 'lacking_hours' => 12.5, 'deficient_hours' => 12.5,
            'status' => PromissoryNote::STATUS_PENDING, 'file_path' => 'p.pdf', 'file_name' => 'p.pdf', 'mime_type' => 'application/pdf', 'file_size' => 1]);
        $this->getJson('/api/recipient/term-report')->assertJsonPath('meta.can_submit', true);
        $this->putJson('/api/recipient/term-report', $this->report())->assertOk();
    }

    public function test_a_submitted_report_stays_editable_and_system_testing_skips_the_lock(): void
    {
        // Already in (from before the rule): editing still works mid-term.
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'), null, ['end_date' => Carbon::today()->addMonth()->toDateString()]);
        $this->submitTermReport($assignment);
        Sanctum::actingAs($recipient);
        $this->putJson('/api/recipient/term-report', $this->report(['challenges' => 'Slow printer.']))->assertOk();

        // A System Testing account submits any time.
        config(['swap.test_tools' => true]);
        $tester = $this->makeUser('recipient');
        $tester->forceFill(['testing_added_at' => now()])->save();
        $this->makeAssignment($tester, $this->makeUser('supervisor'), null, ['end_date' => Carbon::today()->addMonth()->toDateString()]);
        Sanctum::actingAs($tester);
        $this->getJson('/api/recipient/term-report')->assertJsonPath('meta.can_submit', true);
        $this->putJson('/api/recipient/term-report', $this->report())->assertOk();
    }

    public function test_recipient_writes_and_edits_their_report(): void
    {
        $recipient = $this->makeUser('recipient');
        $assignment = $this->endTermWithHoursDone($this->makeAssignment($recipient, $this->makeUser('supervisor')));
        Sanctum::actingAs($recipient);

        $this->getJson('/api/recipient/term-report')
            ->assertOk()->assertJsonPath('data', null)->assertJsonPath('meta.editable', true);

        $this->putJson('/api/recipient/term-report', $this->report(['content' => 'Too short.']))
            ->assertStatus(422)->assertJsonPath('errors.content.0', 'Your report must be at least 50 characters.');

        $this->putJson('/api/recipient/term-report', $this->report())
            ->assertOk()
            ->assertJsonPath('data.assignment_id', $assignment->id)
            ->assertJsonPath('message', 'End-of-term report saved. You can edit it until your supervisor accepts it or your stipend is released.');
        $submittedAt = $assignment->termReport()->first()->submitted_at;

        $this->putJson('/api/recipient/term-report', $this->report(['challenges' => 'Slow printer.']))
            ->assertOk()->assertJsonPath('data.challenges', 'Slow printer.');

        // One report per assignment; editing keeps the original submission time.
        $this->assertSame(1, $assignment->termReport()->count());
        $this->assertEquals($submittedAt, $assignment->termReport()->first()->submitted_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'term_report_submitted', 'user_id' => $recipient->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'term_report_updated', 'user_id' => $recipient->id]);
    }

    public function test_the_report_locks_once_the_stipend_is_released(): void
    {
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'));
        $this->submitTermReport($assignment);
        StipendHistory::create([
            'user_id' => $recipient->id,
            'amount' => 5000,
            'academic_year' => $assignment->academic_year,
            'semester' => $assignment->semester,
            'status' => StipendHistory::STATUS_CERTIFIED,
        ]);

        Sanctum::actingAs($recipient);
        $this->getJson('/api/recipient/term-report')->assertOk()->assertJsonPath('meta.editable', false);
        $this->putJson('/api/recipient/term-report', $this->report())
            ->assertStatus(422)->assertJsonPath('message', TermReportService::MSG_LOCKED);
    }

    public function test_a_recipient_without_an_assignment_cannot_submit(): void
    {
        Sanctum::actingAs($this->makeUser('recipient'));

        $this->putJson('/api/recipient/term-report', $this->report())
            ->assertStatus(422)->assertJsonPath('message', TermReportService::MSG_NO_ASSIGNMENT);
    }

    public function test_the_supervisor_reads_it_on_the_student_summary(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $supervisor);

        Sanctum::actingAs($supervisor);
        $this->getJson("/api/supervisor/students/{$recipient->id}/summary")
            ->assertOk()->assertJsonPath('term_report', null);

        $this->submitTermReport($assignment);
        $this->getJson("/api/supervisor/students/{$recipient->id}/summary")
            ->assertOk()->assertJsonPath('term_report.assignment_id', $assignment->id);

        // Only recipients write it.
        $this->putJson('/api/recipient/term-report', $this->report())->assertStatus(403);
    }
}
