<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\Office;
use App\Models\User;
use App\Services\AssignmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** An office's max_recipients stops new placements and moves (renewals are exempt, see RenewalTest). */
class OfficeCapacityTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function place(User $recipient, Office $office, User $supervisor)
    {
        return $this->postJson('/api/admin/assignments', [
            'user_id' => $recipient->id, 'office_id' => $office->id, 'supervisor_id' => $supervisor->id,
            'academic_year' => '2024-2025', 'semester' => '1st Semester', 'required_hours' => 200,
            'start_date' => now()->toDateString(),
        ]);
    }

    private function fullMessage(Office $office, int $taken): string
    {
        return sprintf(AssignmentService::MSG_OFFICE_FULL, $office->name, $taken, $office->max_recipients);
    }

    public function test_the_last_seat_can_be_taken_then_the_office_is_full(): void
    {
        $office = $this->makeOffice(['name' => 'University Library', 'max_recipients' => 2]);
        $supervisor = $this->makeUser('supervisor', ['office_id' => $office->id]);
        $this->makeAssignment($this->makeUser('recipient'), $supervisor, $office);
        // A finished term doesn't hold a seat.
        $this->makeAssignment($this->makeUser('recipient'), $supervisor, $office, ['status' => 'completed']);

        Sanctum::actingAs($this->makeUser('admin'));
        $this->place($this->makeUser('recipient'), $office, $supervisor)->assertStatus(201);

        $late = $this->makeUser('recipient');
        $this->place($late, $office, $supervisor)->assertStatus(422)
            ->assertJsonPath('errors.office_id.0', $this->fullMessage($office, 2));
        $this->assertSame(0, Assignment::where('user_id', $late->id)->count());

        // Raising the limit frees a seat.
        $office->update(['max_recipients' => 3]);
        $this->place($late, $office, $supervisor)->assertStatus(201);
    }

    public function test_moving_into_a_full_office_is_refused_but_staying_is_fine(): void
    {
        $full = $this->makeOffice(['name' => 'Registrar', 'max_recipients' => 1]);
        $fullSup = $this->makeUser('supervisor', ['office_id' => $full->id]);
        $this->makeAssignment($this->makeUser('recipient'), $fullSup, $full);

        $home = $this->makeOffice(['max_recipients' => 1]);
        $homeSup = $this->makeUser('supervisor', ['office_id' => $home->id]);
        $otherSup = $this->makeUser('supervisor', ['office_id' => $home->id]);
        $mine = $this->makeAssignment($this->makeUser('recipient'), $homeSup, $home);

        Sanctum::actingAs($this->makeUser('admin'));
        $this->putJson("/api/admin/assignments/{$mine->id}", ['office_id' => $full->id, 'supervisor_id' => $fullSup->id])
            ->assertStatus(422)->assertJsonPath('errors.office_id.0', $this->fullMessage($full, 1));
        $this->assertSame($home->id, $mine->fresh()->office_id);

        // Their own (full) office: a supervisor change is never blocked.
        $this->putJson("/api/admin/assignments/{$mine->id}", ['office_id' => $home->id, 'supervisor_id' => $otherSup->id])
            ->assertOk();
        $this->assertSame($otherSup->id, $mine->fresh()->supervisor_id);
    }
}
