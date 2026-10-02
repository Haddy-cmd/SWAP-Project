<?php

namespace Tests\Feature;

use App\Models\SemesterPeriod;
use App\Models\TermEvaluation;
use App\Services\TermEvaluationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** The supervisor's end-of-term evaluation: 1–5 with remarks, 3+ passes. */
class TermEvaluationTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_governing_supervisor_saves_and_updates_the_evaluation(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $assignment = $this->makeAssignment($this->makeUser('recipient'), $supervisor);
        $url = "/api/supervisor/assignments/{$assignment->id}/evaluation";
        Sanctum::actingAs($supervisor);

        $this->getJson($url)->assertOk()->assertJsonPath('data', null);

        $this->putJson($url, ['rating' => 2, 'remarks' => 'Often late; needs supervision.'])->assertOk()
            ->assertJsonPath('message', 'Evaluation saved.')
            ->assertJsonPath('data.rating', 2)
            ->assertJsonPath('data.rating_label', 'Fair')
            ->assertJsonPath('data.passed', false);

        // Editable while the placement is current; one evaluation per placement.
        $this->putJson($url, ['rating' => 3, 'remarks' => 'Improved after midterms.'])->assertOk()
            ->assertJsonPath('data.passed', true);
        $this->assertSame(1, TermEvaluation::where('assignment_id', $assignment->id)->count());
        $this->getJson($url)->assertOk()->assertJsonPath('data.rating', 3)->assertJsonPath('data.remarks', 'Improved after midterms.');

        $this->assertDatabaseHas('audit_logs', ['action' => 'term_evaluated', 'user_id' => $supervisor->id]);

        // The student page carries it.
        $this->getJson("/api/supervisor/students/{$assignment->user_id}/summary")->assertOk()
            ->assertJsonPath('assignment_id', $assignment->id)
            ->assertJsonPath('evaluation.rating', 3);
    }

    public function test_rating_and_remarks_are_required(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $assignment = $this->makeAssignment($this->makeUser('recipient'), $supervisor);
        Sanctum::actingAs($supervisor);
        $url = "/api/supervisor/assignments/{$assignment->id}/evaluation";

        $this->putJson($url, ['rating' => 6, 'remarks' => 'x'])->assertStatus(422)
            ->assertJsonPath('errors.rating.0', 'Choose a rating from 1 to 5.');
        $this->putJson($url, ['rating' => 4])->assertStatus(422)
            ->assertJsonPath('errors.remarks.0', 'Add remarks about the student’s service this term.');
        $this->putJson($url, ['rating' => 4, 'remarks' => str_repeat('a', 2001)])->assertStatus(422);
    }

    public function test_only_a_governing_supervisor_and_only_while_current(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $assignment = $this->makeAssignment($this->makeUser('recipient'), $supervisor);
        $url = "/api/supervisor/assignments/{$assignment->id}/evaluation";
        $payload = ['rating' => 4, 'remarks' => 'Good work.'];

        Sanctum::actingAs($this->makeUser('supervisor'));
        $this->getJson($url)->assertStatus(404);
        $this->putJson($url, $payload)->assertStatus(404);

        Sanctum::actingAs($this->makeUser('recipient'));
        $this->putJson($url, $payload)->assertStatus(403);

        $assignment->update(['status' => 'completed']);
        Sanctum::actingAs($supervisor);
        $this->putJson($url, $payload)->assertStatus(422)
            ->assertJsonPath('message', TermEvaluationService::MSG_NOT_ACTIVE);
        $this->assertSame(0, TermEvaluation::count());
    }

    public function test_the_roster_flags_evaluations_due_near_the_term_end(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $due = $this->makeAssignment($this->makeUser('recipient'), $supervisor);
        $later = $this->makeAssignment($this->makeUser('recipient'), $supervisor, null, ['semester' => 'Summer']);
        $today = Carbon::now('Asia/Manila');
        SemesterPeriod::create(['academic_year' => '2024-2025', 'semester' => '1st Semester',
            'start_date' => $today->copy()->subMonths(4)->toDateString(), 'end_date' => $today->copy()->addDays(10)->toDateString()]);
        SemesterPeriod::create(['academic_year' => '2024-2025', 'semester' => 'Summer',
            'start_date' => $today->copy()->addMonths(2)->toDateString(), 'end_date' => $today->copy()->addMonths(3)->toDateString()]);

        Sanctum::actingAs($supervisor);
        $rows = collect($this->getJson('/api/supervisor/students')->assertOk()->json('data'))->keyBy('id');
        $this->assertTrue($rows[$due->id]['evaluation_due']);
        $this->assertFalse($rows[$later->id]['evaluation_due']);

        $this->putJson("/api/supervisor/assignments/{$due->id}/evaluation", ['rating' => 5, 'remarks' => 'Excellent.'])->assertOk();
        $rows = collect($this->getJson('/api/supervisor/students')->assertOk()->json('data'))->keyBy('id');
        $this->assertFalse($rows[$due->id]['evaluation_due']);
        $this->assertSame(5, $rows[$due->id]['evaluation']['rating']);
    }
}
