<?php

use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('admin can approve an application', function () {
    $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
    $applicant = User::factory()->create(['role' => 'applicant']);
    $application = Application::factory()->create(['user_id' => $applicant->id, 'status' => 'under_review']);

    $this->actingAs($admin, 'sanctum')
        ->putJson("/api/admin/applications/{$application->id}/decide", [
            'decision' => 'approved',
            'remarks' => 'Meets all requirements.',
        ])->assertStatus(200)
            ->assertJson(['data' => ['status' => 'approved']]);
});

it('admin can reject an application', function () {
    $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
    $applicant = User::factory()->create(['role' => 'applicant']);
    $application = Application::factory()->create(['user_id' => $applicant->id, 'status' => 'under_review']);

    $this->actingAs($admin, 'sanctum')
        ->putJson("/api/admin/applications/{$application->id}/decide", [
            'decision' => 'rejected',
            'remarks' => 'Does not meet financial need criteria.',
        ])->assertStatus(200)
            ->assertJson(['data' => ['status' => 'rejected']]);
});

it('admin can schedule an interview', function () {
    $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
    $applicant = User::factory()->create(['role' => 'applicant']);
    $application = Application::factory()->create(['user_id' => $applicant->id, 'status' => 'under_review']);

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/admin/applications/{$application->id}/interview", [
            'scheduled_at' => now()->addDays(3)->toISOString(),
            'location' => 'DSA Office, Room 101',
            'mode' => 'in_person',
        ])->assertStatus(200)
            ->assertJsonPath('data.status', 'interview_scheduled');
});

it('non-admin cannot access admin application routes', function () {
    $applicant = User::factory()->create(['role' => 'applicant', 'is_active' => true]);
    $application = Application::factory()->create();

    $this->actingAs($applicant, 'sanctum')
        ->getJson('/api/admin/applications')
        ->assertStatus(403);
});
