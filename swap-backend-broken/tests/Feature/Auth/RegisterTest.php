<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('registers a new applicant successfully', function () {
    $response = $this->postJson('/api/auth/register', [
        'name' => 'Test Student',
        'email' => 'test@student.msu.edu.ph',
        'password' => 'Password@123',
        'password_confirmation' => 'Password@123',
        'student_id_number' => '2024-0001',
        'first_name' => 'Test',
        'last_name' => 'Student',
        'college' => 'CSST',
        'program' => 'BSCS',
        'year_level' => 2,
    ]);

    $response->assertStatus(201)
        ->assertJsonStructure([
            'data' => ['id', 'name', 'email', 'role'],
            'token',
        ]);

    expect(User::where('email', 'test@student.msu.edu.ph')->exists())->toBeTrue();
});

it('rejects registration with duplicate email', function () {
    User::factory()->create(['email' => 'existing@test.com']);

    $this->postJson('/api/auth/register', [
        'name' => 'Another User',
        'email' => 'existing@test.com',
        'password' => 'Password@123',
        'password_confirmation' => 'Password@123',
        'student_id_number' => '2024-9999',
        'first_name' => 'Another',
        'last_name' => 'User',
        'college' => 'CAS',
        'program' => 'BSMATH',
        'year_level' => 1,
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});

it('rejects registration with invalid data', function () {
    $this->postJson('/api/auth/register', [
        'name' => '',
        'email' => 'not-an-email',
        'password' => '123',
        'year_level' => 10,
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['name', 'email', 'password', 'year_level']);
});

it('rejects registration when password confirmation does not match', function () {
    $this->postJson('/api/auth/register', [
        'name' => 'Test',
        'email' => 'test@test.com',
        'password' => 'Password@123',
        'password_confirmation' => 'Different@456',
        'student_id_number' => '2024-0002',
        'first_name' => 'Test',
        'last_name' => 'User',
        'college' => 'CSST',
        'program' => 'BSCS',
        'year_level' => 1,
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['password']);
});
