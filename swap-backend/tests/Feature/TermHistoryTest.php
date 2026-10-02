<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\StipendHistory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Hours are per term: log lists default to the current placement; past terms are history. */
class TermHistoryTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    /** @return array{0: User, 1: User, 2: Assignment, 3: Assignment} recipient, supervisor, old, current */
    private function renewedRecipient(): array
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $old = $this->makeAssignment($recipient, $supervisor, null, [
            'required_hours' => 10, 'status' => 'completed', 'term_status' => Assignment::TERM_DEFICIENT, 'deficient_hours' => 4,
        ]);
        $this->makeClosedLog($old, 2, daysAgo: 60);
        $this->makeClosedLog($old, 4, daysAgo: 50);
        $current = $this->makeAssignment($recipient, $supervisor, $old->office, [
            'semester' => '2nd Semester', 'required_hours' => 10,
        ]);
        $this->makeClosedLog($current, 3, daysAgo: 2);

        return [$recipient, $supervisor, $old, $current];
    }

    public function test_recipient_logs_default_to_the_current_term(): void
    {
        [$recipient, , , $current] = $this->renewedRecipient();
        Sanctum::actingAs($recipient);

        $this->getJson('/api/recipient/attendance/logs')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.assignment_id', $current->id);

        // The duty slip asks for every term.
        $this->getJson('/api/recipient/attendance/logs?scope=all&per_page=300')->assertOk()->assertJsonCount(3, 'data');
        $this->getJson('/api/recipient/attendance/logs?scope=everything')->assertStatus(422);

        // The current term's summary starts from its own hours only.
        $this->getJson('/api/recipient/hours/summary')->assertOk()->assertJsonPath('data.verified', 3);
    }

    public function test_supervisor_student_logs_default_to_the_current_term(): void
    {
        [$recipient, $supervisor] = $this->renewedRecipient();
        Sanctum::actingAs($supervisor);

        $this->getJson("/api/supervisor/students/{$recipient->id}/logs")->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/supervisor/students/{$recipient->id}/logs?scope=all&per_page=300")->assertOk()->assertJsonCount(3, 'data');
    }

    public function test_past_terms_are_listed_with_their_hours_verdict_and_stipend(): void
    {
        [$recipient, , $old] = $this->renewedRecipient();
        StipendHistory::create([
            'user_id' => $recipient->id, 'amount' => 5000, 'academic_year' => '2024-2025', 'semester' => '1st Semester',
            'status' => StipendHistory::STATUS_CLAIMED, 'via_promissory' => true,
        ]);
        Sanctum::actingAs($recipient);

        $this->getJson('/api/recipient/assignments/history')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.assignment_id', $old->id)
            ->assertJsonPath('data.0.semester', '1st Semester')
            ->assertJsonPath('data.0.verified_hours', 6)
            ->assertJsonPath('data.0.required_hours', 10)
            ->assertJsonPath('data.0.term_status', 'deficient')
            ->assertJsonPath('data.0.deficient_hours', 4)
            ->assertJsonPath('data.0.stipend_status', 'claimed')
            ->assertJsonPath('data.0.stipend_via_promissory', true);
    }

    public function test_average_completion_counts_only_current_terms(): void
    {
        $this->renewedRecipient(); // current: 3 of 10 verified; the old term's 6 must not count
        Sanctum::actingAs($this->makeUser('admin'));

        $this->getJson('/api/admin/analytics/overview?academic_year=2024-2025&semester=2nd%20Semester')->assertOk()
            ->assertJsonPath('data.avg_completion_rate', 30);
    }
}
