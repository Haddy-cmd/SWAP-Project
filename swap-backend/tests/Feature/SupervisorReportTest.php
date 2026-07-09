<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\Office;
use App\Models\TimeLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

class SupervisorReportTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    /** A closed log of the given length, in whatever state the roster should count it as. */
    private function closedLog(Assignment $assignment, User $recipient, float $hours, string $status): TimeLog
    {
        $log = $this->makeOpenLog($assignment, $recipient, now()->subHours((int) $hours));
        $log->update(['time_out' => now(), 'status' => $status]);

        return $log->fresh();
    }

    public function test_roster_lists_only_students_the_supervisor_can_see(): void
    {
        $office = $this->makeOffice();
        $supervisor = $this->makeUser('supervisor', ['office_id' => $office->id]);

        $mine = $this->makeUser('recipient', ['name' => 'Amina Roster']);
        $this->makeAssignment($mine, $supervisor, $office);

        $theirs = $this->makeUser('recipient', ['name' => 'Unrelated Student']);
        $this->makeAssignment($theirs, $this->makeUser('supervisor'));

        Sanctum::actingAs($supervisor);
        $res = $this->getJson('/api/supervisor/reports/roster')->assertStatus(200);

        $names = collect($res->json('data.rows'))->pluck(0);
        $this->assertContains('Amina Roster', $names);
        $this->assertNotContains('Unrelated Student', $names);
        $res->assertJsonPath('data.totals.recipients', 1);
    }

    public function test_co_supervisor_of_the_same_office_exports_the_shared_roster(): void
    {
        $office = $this->makeOffice();
        $owner = $this->makeUser('supervisor', ['office_id' => $office->id]);
        $coSupervisor = $this->makeUser('supervisor', ['office_id' => $office->id]);

        $student = $this->makeUser('recipient', ['name' => 'Shared Student']);
        $this->makeAssignment($student, $owner, $office);

        // The co-supervisor never owns the assignment, but shares the office.
        Sanctum::actingAs($coSupervisor);
        $this->getJson('/api/supervisor/reports/roster')
            ->assertStatus(200)
            ->assertJsonPath('data.totals.recipients', 1)
            ->assertJsonPath('data.rows.0.0', 'Shared Student');
    }

    public function test_roster_totals_split_verified_from_pending_hours(): void
    {
        $office = $this->makeOffice();
        $supervisor = $this->makeUser('supervisor', ['office_id' => $office->id]);
        $student = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($student, $supervisor, $office, ['required_hours' => 200]);

        $this->closedLog($assignment, $student, 6, 'verified');
        $this->closedLog($assignment, $student, 4, 'pending_verification');
        $this->closedLog($assignment, $student, 3, 'rejected');

        Sanctum::actingAs($supervisor);
        $res = $this->getJson('/api/supervisor/reports/roster')->assertStatus(200);

        // Rejected hours count toward neither total, and remaining tracks verified only.
        $res->assertJsonPath('data.totals.verified', 6)
            ->assertJsonPath('data.totals.pending', 4);

        $row = $res->json('data.rows.0');
        $this->assertEquals(200, $row[6], 'required hours');
        $this->assertEquals(6, $row[7], 'verified hours');
        $this->assertEquals(4, $row[8], 'pending hours');
        $this->assertEquals(194, $row[9], 'remaining hours');
    }

    public function test_export_streams_a_csv_with_a_header_row(): void
    {
        $office = $this->makeOffice();
        $supervisor = $this->makeUser('supervisor', ['office_id' => $office->id]);
        $this->makeAssignment($this->makeUser('recipient', ['name' => 'Csv Student']), $supervisor, $office);

        Sanctum::actingAs($supervisor);
        $res = $this->get('/api/supervisor/reports/roster/export')->assertStatus(200);
        $res->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        $csv = $res->streamedContent();
        $this->assertStringContainsString('Recipient', $csv);
        $this->assertStringContainsString('% Complete', $csv);
        $this->assertStringContainsString('Csv Student', $csv);
    }

    public function test_recipient_cannot_export_a_supervisor_roster(): void
    {
        Sanctum::actingAs($this->makeUser('recipient'));
        $this->getJson('/api/supervisor/reports/roster')->assertStatus(403);
        $this->getJson('/api/supervisor/reports/roster/export')->assertStatus(403);
    }

    // ── pace ────────────────────────────────────────────────────────────────────

    /** An assignment spanning a term, with `$elapsedDays` of it already gone. */
    private function datedAssignment(int $lengthDays, int $elapsedDays, int $requiredHours = 200): Assignment
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');

        return $this->makeAssignment($recipient, $supervisor, null, [
            'required_hours' => $requiredHours,
            'start_date' => Carbon::today()->subDays($elapsedDays)->toDateString(),
            'end_date' => Carbon::today()->addDays($lengthDays - $elapsedDays)->toDateString(),
        ]);
    }

    public function test_pace_is_behind_when_hours_lag_the_elapsed_term(): void
    {
        // Half the term gone, so ~100 of 200 hours expected — none rendered.
        $assignment = $this->datedAssignment(lengthDays: 100, elapsedDays: 50);

        $pace = $assignment->paceStatus();
        $this->assertSame('behind', $pace['status']);
        $this->assertEqualsWithDelta(100, $pace['expected_hours'], 2.0);
        $this->assertEqualsWithDelta(100, $pace['deficit_hours'], 2.0);
    }

    public function test_pace_is_on_track_when_hours_keep_up_with_the_term(): void
    {
        $assignment = $this->datedAssignment(lengthDays: 100, elapsedDays: 50);
        $this->closedLog($assignment, $assignment->user, 12, 'verified');

        // 12h against ~100h expected is still behind — prove the grace band isn't
        // doing the work, then give them the hours they actually owe.
        $this->assertSame('behind', $assignment->fresh()->paceStatus()['status']);

        $ahead = $this->datedAssignment(lengthDays: 100, elapsedDays: 2, requiredHours: 200);
        $this->closedLog($ahead, $ahead->user, 10, 'verified');
        $this->assertSame('on_track', $ahead->fresh()->paceStatus()['status']);
    }

    public function test_pace_is_complete_once_required_hours_are_verified(): void
    {
        $assignment = $this->datedAssignment(lengthDays: 100, elapsedDays: 90, requiredHours: 5);
        $this->closedLog($assignment, $assignment->user, 6, 'verified');

        $pace = $assignment->fresh()->paceStatus();
        $this->assertSame('complete', $pace['status']);
        $this->assertSame(0.0, $pace['deficit_hours']);
        $this->assertSame(100.0, $pace['percent']);
    }

    public function test_pace_falls_back_to_a_flat_threshold_when_the_term_has_no_end_date(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        // makeAssignment leaves end_date null, so there is no deadline to measure against.
        $assignment = $this->makeAssignment($recipient, $supervisor, null, ['required_hours' => 100]);

        $this->assertSame('not_started', $assignment->paceStatus()['status']);
        $this->assertNull($assignment->paceStatus()['expected_hours']);

        $this->closedLog($assignment, $recipient, 10, 'verified');
        $this->assertSame('behind', $assignment->fresh()->paceStatus()['status']);

        $this->closedLog($assignment, $recipient, 20, 'verified');
        $this->assertSame('on_track', $assignment->fresh()->paceStatus()['status']);
    }

    public function test_pending_hours_do_not_count_toward_pace(): void
    {
        $assignment = $this->datedAssignment(lengthDays: 100, elapsedDays: 50);
        $this->closedLog($assignment, $assignment->user, 9, 'pending_verification');

        // Unverified hours are a claim, not an achievement — the student is still behind.
        $pace = $assignment->fresh()->paceStatus();
        $this->assertSame('behind', $pace['status']);
        $this->assertSame(0.0, $pace['percent']);
    }
}
