<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin → Assignments → Move: never to the office the student is already in. */
class MovePlacementTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_moving_to_the_same_office_is_refused_but_a_supervisor_change_or_real_move_works(): void
    {
        Notification::fake();
        $office = $this->makeReadyOffice(['name' => 'College of Agriculture']);
        $first = User::where('office_id', $office->id)->firstOrFail();
        $second = $this->makeUser('supervisor', ['office_id' => $office->id]);
        $student = $this->makeUser('recipient', ['name' => 'Hedjara A. Abdul']);
        $assignment = $this->makeAssignment($student, $first, $office);
        Sanctum::actingAs($this->makeUser('admin'));

        // Same office, same supervisor: not a move.
        $this->putJson("/api/admin/assignments/{$assignment->id}", ['office_id' => $office->id, 'supervisor_id' => $first->id])
            ->assertStatus(422)
            ->assertJsonPath('errors.office_id.0', 'Hedjara A. Abdul is already placed at College of Agriculture. Pick a different office.');
        $this->putJson("/api/admin/assignments/{$assignment->id}", ['office_id' => $office->id])->assertStatus(422);
        Notification::assertNothingSent();

        // Another supervisor in the same office is allowed.
        $this->putJson("/api/admin/assignments/{$assignment->id}", ['office_id' => $office->id, 'supervisor_id' => $second->id])->assertOk();
        $this->assertSame($second->id, $assignment->fresh()->supervisor_id);

        // A real move works.
        $other = $this->makeReadyOffice();
        $otherSup = User::where('office_id', $other->id)->firstOrFail();
        $this->putJson("/api/admin/assignments/{$assignment->id}", ['office_id' => $other->id, 'supervisor_id' => $otherSup->id])->assertOk();
        $this->assertSame($other->id, $assignment->fresh()->office_id);
    }
}
