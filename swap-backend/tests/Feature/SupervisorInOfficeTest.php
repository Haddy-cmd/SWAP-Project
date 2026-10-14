<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * Supervisors are linked to offices only in Offices (or when invited). A placement — new, moved,
 * or "Change supervisor only" — picks one of its office's active supervisors.
 */
class SupervisorInOfficeTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_a_placement_needs_a_supervisor_of_that_office(): void
    {
        Notification::fake();
        $registrar = $this->makeReadyOffice(['name' => 'Records Section']);
        $library = $this->makeReadyOffice(['name' => 'Reading Room']);
        $regSup = User::where('office_id', $registrar->id)->firstOrFail();
        $libSup = User::where('office_id', $library->id)->firstOrFail();
        $libSup->update(['name' => 'Prof. Reading']);
        $student = $this->makeUser('recipient');
        Sanctum::actingAs($this->makeUser('admin'));
        $payload = fn (int $officeId, int $supervisorId) => [
            'user_id' => $student->id, 'office_id' => $officeId, 'supervisor_id' => $supervisorId,
            'academic_year' => '2026-2027', 'semester' => '1st Semester', 'required_hours' => 200, 'start_date' => now()->toDateString(),
        ];

        // New placement with another office's supervisor: refused, nothing created.
        $this->postJson('/api/admin/assignments', $payload($registrar->id, $libSup->id))->assertStatus(422)
            ->assertJsonPath('errors.supervisor_id.0', "Prof. Reading isn't a supervisor at Records Section. Add them to the office in Offices first.");
        // Not a supervisor at all, or deactivated: refused too.
        $this->postJson('/api/admin/assignments', $payload($registrar->id, $student->id))->assertStatus(422)->assertJsonValidationErrors('supervisor_id');
        $off = $this->makeUser('supervisor', ['office_id' => $registrar->id, 'is_active' => false]);
        $this->postJson('/api/admin/assignments', $payload($registrar->id, $off->id))->assertStatus(422)->assertJsonValidationErrors('supervisor_id');

        $id = $this->postJson('/api/admin/assignments', $payload($registrar->id, $regSup->id))->assertCreated()->json('data.id');

        // "Change supervisor only" to someone from another office: refused.
        $this->putJson("/api/admin/assignments/{$id}", ['office_id' => $registrar->id, 'supervisor_id' => $libSup->id])
            ->assertStatus(422)->assertJsonValidationErrors('supervisor_id');
        // Moving offices but keeping the old office's supervisor: refused.
        $this->putJson("/api/admin/assignments/{$id}", ['office_id' => $library->id])
            ->assertStatus(422)->assertJsonValidationErrors('supervisor_id');
        // A real move with the new office's supervisor works; a co-supervisor in the same office works too.
        $this->putJson("/api/admin/assignments/{$id}", ['office_id' => $library->id, 'supervisor_id' => $libSup->id])->assertOk();
        $co = $this->makeUser('supervisor', ['office_id' => $library->id]);
        $this->putJson("/api/admin/assignments/{$id}", ['office_id' => $library->id, 'supervisor_id' => $co->id])->assertOk();
        // Status-only edits are unaffected.
        $this->putJson("/api/admin/assignments/{$id}", ['status' => 'suspended'])->assertOk();
    }
}
