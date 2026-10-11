<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin → Users v2: sorting, the "not verified" filter, bulk deactivate, delete keeping records. */
class AdminUsersListTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_sorting_and_the_not_verified_filter(): void
    {
        $admin = $this->makeUser('admin', ['name' => 'Mid Admin', 'email_verified_at' => now()]);
        $old = $this->makeUser('applicant', ['name' => 'Zed Oldest', 'email_verified_at' => now()]);
        $old->forceFill(['created_at' => now()->subDays(5)])->save();
        $new = $this->makeUser('applicant', ['name' => 'amy Newest', 'email_verified_at' => null]);
        $new->forceFill(['created_at' => now()->addMinute()])->save();
        Sanctum::actingAs($admin);

        $this->assertSame($new->id, $this->getJson('/api/admin/users')->json('data.0.id'));
        $this->assertSame($old->id, $this->getJson('/api/admin/users?sort=old')->json('data.0.id'));
        $this->assertSame('amy Newest', $this->getJson('/api/admin/users?sort=az')->json('data.0.name'));
        $this->getJson('/api/admin/users?unverified=1')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $new->id);
        $this->getJson('/api/admin/users?per_page=2')->assertJsonCount(2, 'data')->assertJsonPath('meta.per_page', 2);
    }

    public function test_bulk_deactivate_skips_admins_and_yourself(): void
    {
        $admin = $this->makeUser('admin');
        $otherAdmin = $this->makeUser('admin');
        $a = $this->makeUser('recipient');
        $b = $this->makeUser('supervisor');
        $a->createToken('auth_token');
        Sanctum::actingAs($admin);

        $this->postJson('/api/admin/users/bulk-deactivate', ['ids' => [$a->id, $b->id, $otherAdmin->id, $admin->id]])->assertOk()
            ->assertJsonPath('data.deactivated', 2)->assertJsonPath('data.skipped', 2)
            ->assertJsonPath('message', '2 accounts deactivated.');

        $this->assertFalse((bool) $a->fresh()->is_active);
        $this->assertFalse((bool) $b->fresh()->is_active);
        $this->assertTrue((bool) $otherAdmin->fresh()->is_active);
        $this->assertTrue((bool) $admin->fresh()->is_active);
        $this->assertSame(0, $a->tokens()->count());
        $this->assertSame(2, AuditLog::where('action', 'updated')->whereIn('auditable_id', [$a->id, $b->id])->count());

        Sanctum::actingAs($this->makeUser('supervisor'));
        $this->postJson('/api/admin/users/bulk-deactivate', ['ids' => [$a->id]])->assertForbidden();
    }

    public function test_deleting_keeps_the_placement_and_its_hours(): void
    {
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'));
        $log = $this->makeClosedLog($assignment, 3);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->deleteJson("/api/admin/users/{$recipient->id}")->assertOk();

        $this->assertSoftDeleted('users', ['id' => $recipient->id]);
        $this->assertSame('completed', Assignment::find($assignment->id)->status);
        $this->assertDatabaseHas('time_logs', ['id' => $log->id]);
    }
}
