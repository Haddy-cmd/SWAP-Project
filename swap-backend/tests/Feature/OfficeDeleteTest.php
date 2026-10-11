<?php

namespace Tests\Feature;

use App\Http\Controllers\Admin\OfficeController;
use App\Models\Office;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** An office can be deleted only if no student was ever placed there. */
class OfficeDeleteTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_an_unused_office_is_deleted_and_its_supervisor_left_without_one(): void
    {
        $office = $this->makeOffice();
        $supervisor = $this->makeUser('supervisor', ['office_id' => $office->id]);
        Sanctum::actingAs($admin = $this->makeUser('admin'));

        $this->deleteJson("/api/admin/offices/{$office->id}")->assertOk()->assertJsonPath('message', 'Office deleted.');

        $this->assertNull(Office::find($office->id));
        $this->assertNull($supervisor->fresh()->office_id);
        $this->assertDatabaseHas('audit_logs', ['action' => 'office_deleted', 'auditable_id' => $office->id, 'user_id' => $admin->id]);
    }

    public function test_an_office_with_placement_history_is_refused(): void
    {
        $office = $this->makeOffice();
        $this->makeAssignment($this->makeUser('recipient'), $this->makeUser('supervisor'), $office, ['status' => 'completed']);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->deleteJson("/api/admin/offices/{$office->id}")
            ->assertStatus(422)->assertJsonPath('message', OfficeController::MSG_HAS_HISTORY);
        $this->assertNotNull(Office::find($office->id));
    }

    public function test_only_admins_delete_offices(): void
    {
        $office = $this->makeOffice();
        Sanctum::actingAs($this->makeUser('supervisor'));

        $this->deleteJson("/api/admin/offices/{$office->id}")->assertForbidden();
        $this->assertNotNull(Office::find($office->id));
    }
}
