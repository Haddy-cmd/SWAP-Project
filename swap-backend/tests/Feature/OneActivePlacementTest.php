<?php

namespace Tests\Feature;

use App\Models\Assignment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** A student has at most one active placement, and every screen reads the same one. */
class OneActivePlacementTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private const FIX = 'migrations/2026_10_12_000001_close_duplicate_active_placements.php';

    public function test_placing_a_student_active_in_another_term_is_refused(): void
    {
        $recipient = $this->makeUser('recipient', ['name' => 'Jumailah Test']);
        $this->makeAssignment($recipient, $this->makeUser('supervisor'), $this->makeOffice(['name' => 'Campo Ranao St.']),
            ['academic_year' => '2026-2027', 'semester' => '2nd Semester']);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/assignments', [
            'user_id' => $recipient->id, 'office_id' => $this->makeReadyOffice()->id,
            'supervisor_id' => $this->makeUser('supervisor')->id,
            'academic_year' => '2026-2027', 'semester' => '1st Semester',
            'required_hours' => 200, 'start_date' => now()->toDateString(),
        ])->assertStatus(422)->assertJsonPath('errors.user_id.0',
            'Jumailah Test is already placed at Campo Ranao St. for 2nd Semester 2026-2027. Move them with Edit on that placement, or complete that term first.');
        $this->assertSame(1, Assignment::where('user_id', $recipient->id)->count());
    }

    public function test_reactivating_an_old_placement_while_another_is_active_is_refused(): void
    {
        $recipient = $this->makeUser('recipient');
        $supervisor = $this->makeUser('supervisor');
        $old = $this->makeAssignment($recipient, $supervisor, null, ['semester' => '1st Semester', 'status' => 'completed']);
        $this->makeAssignment($recipient, $supervisor, null, ['semester' => '2nd Semester']);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->putJson("/api/admin/assignments/{$old->id}", ['status' => 'active'])->assertStatus(422);
        $this->assertSame('completed', $old->fresh()->status);
    }

    public function test_old_duplicates_resolve_to_the_newest_everywhere_and_the_fix_closes_the_rest(): void
    {
        $recipient = $this->makeUser('recipient');
        $supervisor = $this->makeUser('supervisor');
        $older = $this->makeAssignment($recipient, $supervisor, $this->makeOffice(['name' => 'Campo Ranao St.']),
            ['academic_year' => '2026-2027', 'semester' => '2nd Semester']);
        $newer = $this->makeAssignment($recipient, $supervisor, $this->makeOffice(['name' => 'Division of Student Affairs']),
            ['academic_year' => '2026-2027', 'semester' => '1st Semester']);
        $this->makeClosedLog($newer, 5);

        // Before the fix, the dashboard reads the newest one (as System Testing does).
        Sanctum::actingAs($recipient);
        $this->getJson('/api/recipient/progress')->assertOk()
            ->assertJsonPath('data.term', '1st Semester 2026-2027')
            ->assertJsonPath('data.breakdown.verified_hours', 5);

        (require database_path(self::FIX))->up();

        $this->assertSame('active', $newer->fresh()->status);
        $this->assertSame('completed', $older->fresh()->status);
        $this->assertDatabaseHas('audit_logs', ['action' => 'placement_closed_duplicate', 'auditable_id' => $older->id]);

        // Safe to run again.
        (require database_path(self::FIX))->up();
        $this->assertSame(1, Assignment::where('user_id', $recipient->id)->where('status', 'active')->count());
    }
}
