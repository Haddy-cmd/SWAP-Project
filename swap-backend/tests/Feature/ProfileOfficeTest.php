<?php

namespace Tests\Feature;

use App\Models\StaffInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** A supervisor's own profile names their office (it showed "Unassigned office" before). */
class ProfileOfficeTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_profile_and_invitation_acceptance_include_the_office_name(): void
    {
        $office = $this->makeOffice(['name' => 'Division of Student Affairs']);
        $supervisor = $this->makeUser('supervisor', ['office_id' => $office->id]);

        Sanctum::actingAs($supervisor);
        $this->getJson('/api/profile')->assertOk()->assertJsonPath('data.office_name', 'Division of Student Affairs');

        // A new supervisor accepting an invitation for an office sees it right away too.
        $plain = str_repeat('c', 64);
        StaffInvitation::create([
            'email' => 'newsup@msumain.edu.ph', 'role' => 'supervisor', 'office_id' => $office->id,
            'token' => hash('sha256', $plain), 'invited_by' => $this->makeUser('admin')->id, 'expires_at' => now()->addDays(3),
        ]);
        $this->postJson("/api/invitations/{$plain}/accept", [
            'name' => 'New Supervisor', 'employee_id' => '20201111',
            'password' => 'Secret123', 'password_confirmation' => 'Secret123', 'privacy_consent' => true,
        ])->assertCreated()->assertJsonPath('data.office_name', 'Division of Student Affairs');
    }
}
