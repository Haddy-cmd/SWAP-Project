<?php

namespace Tests\Feature;

use App\Models\StipendHistory;
use App\Services\TermReportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

    public function test_recipient_writes_and_edits_their_report(): void
    {
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'));
        Sanctum::actingAs($recipient);

        $this->getJson('/api/recipient/term-report')
            ->assertOk()->assertJsonPath('data', null)->assertJsonPath('meta.editable', true);

        $this->putJson('/api/recipient/term-report', $this->report(['content' => 'Too short.']))
            ->assertStatus(422)->assertJsonPath('errors.content.0', 'Your report must be at least 100 characters.');

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
