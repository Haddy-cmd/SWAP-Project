<?php

namespace Tests\Feature;

use App\Models\Office;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * Admin → Offices v3: an office takes new placements only when it is open and set up
 * (a supervisor, a map pin and a clock-in area). Students already placed and renewals
 * are not affected.
 */
class OfficeReadinessTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function place(int $officeId, ?int $recipientId = null)
    {
        return $this->postJson('/api/admin/assignments', [
            'user_id' => $recipientId ?? $this->makeUser('recipient')->id,
            'office_id' => $officeId,
            // One of the office's own supervisors (AssignmentService::MSG_SUPERVISOR_NOT_IN_OFFICE).
            'supervisor_id' => \App\Models\User::where('role', 'supervisor')->where('office_id', $officeId)->value('id') ?? $this->makeUser('supervisor')->id,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'required_hours' => 200,
            'start_date' => now()->toDateString(),
        ]);
    }

    public function test_the_list_reports_what_each_office_still_needs(): void
    {
        $ready = $this->makeReadyOffice(['name' => 'A Ready']);
        $this->makeGeofencedOffice(['name' => 'B No supervisor']);
        $noPin = $this->makeOffice(['name' => 'C No pin', 'radius_meters' => 50, 'geofence_enabled' => true]);
        $this->makeUser('supervisor', ['office_id' => $noPin->id]);
        $closed = $this->makeReadyOffice(['name' => 'D Closed', 'is_active' => false]);
        Sanctum::actingAs($this->makeUser('admin'));

        $rows = collect($this->getJson('/api/admin/offices?per_page=100')->assertOk()->json('data'))->keyBy('name');
        $this->assertTrue($rows['A Ready']['ready']);
        $this->assertSame([], $rows['A Ready']['missing']);
        $this->assertSame(['supervisor'], $rows['B No supervisor']['missing']);
        $this->assertSame(['location'], $rows['C No pin']['missing']);
        $this->assertFalse($rows['D Closed']['ready']);
        $this->assertSame([], $rows['D Closed']['missing']);
        $this->assertTrue($ready->fresh()->isReady());
        $this->assertFalse($closed->fresh()->isReady());
    }

    public function test_new_placements_need_an_open_set_up_office(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));

        $bare = $this->makeOffice(['name' => 'College of Agriculture']);
        $this->place($bare->id)->assertStatus(422)->assertJsonPath('errors.office_id.0',
            "College of Agriculture isn't set up yet (needs: supervisor, map location, clock-in area). Finish it on the Offices page or pick another office.");

        $closed = $this->makeReadyOffice(['name' => 'Old Office', 'is_active' => false]);
        $this->place($closed->id)->assertStatus(422)->assertJsonPath('errors.office_id.0',
            'Old Office is closed to new placements. Open it on the Offices page or pick another office.');

        $this->place($this->makeReadyOffice()->id)->assertCreated();
    }

    public function test_moving_a_student_into_an_office_not_set_up_is_refused(): void
    {
        $home = $this->makeReadyOffice();
        $assignment = $this->makeAssignment($this->makeUser('recipient'), $this->makeUser('supervisor'), $home);
        $bare = $this->makeOffice(['name' => 'Scholarship Center']);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->putJson("/api/admin/assignments/{$assignment->id}", ['office_id' => $bare->id])->assertStatus(422);
        $this->assertSame($home->id, $assignment->fresh()->office_id);
    }

    public function test_students_already_placed_are_not_affected(): void
    {
        // Placed before the office lost its supervisor and pin: the placement stays and can be edited.
        $office = $this->makeOffice();
        $assignment = $this->makeAssignment($this->makeUser('recipient'), $this->makeUser('supervisor'), $office);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->putJson("/api/admin/assignments/{$assignment->id}", ['end_date' => '2030-05-31'])->assertOk();
        $this->assertSame('2030-05-31', $assignment->fresh()->end_date?->toDateString());
        $this->assertFalse(Office::find($office->id)->isReady());
    }
}
