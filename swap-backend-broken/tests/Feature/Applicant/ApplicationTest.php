<?php

use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('applicant can submit an application', function () {
    $user = User::factory()->create(['role' => 'applicant', 'is_active' => true]);

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/applicant/applications', [
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
        ])->assertStatus(201)
            ->assertJsonStructure(['data' => ['id', 'status', 'academic_year']]);

    expect(Application::where('user_id', $user->id)->exists())->toBeTrue();
});

it('rejects duplicate application for same period', function () {
    $user = User::factory()->create(['role' => 'applicant', 'is_active' => true]);

    Application::factory()->create([
        'user_id' => $user->id,
        'academic_year' => '2024-2025',
        'semester' => '1st Semester',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/applicant/applications', [
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
        ])->assertStatus(409);
});

it('applicant can view their applications', function () {
    $user = User::factory()->create(['role' => 'applicant', 'is_active' => true]);
    Application::factory()->count(3)->create(['user_id' => $user->id]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/applicant/applications')
        ->assertStatus(200)
        ->assertJsonCount(3, 'data');
});

it('non-applicant cannot access applicant routes', function () {
    $recipient = User::factory()->create(['role' => 'recipient', 'is_active' => true]);

    $this->actingAs($recipient, 'sanctum')
        ->postJson('/api/applicant/applications', [
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
        ])->assertStatus(403);
});
