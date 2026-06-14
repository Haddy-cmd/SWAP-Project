<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

it('logs in with valid credentials', function () {
    $user = User::factory()->create([
        'email' => 'user@test.com',
        'password' => Hash::make('Password@123'),
        'is_active' => true,
    ]);

    $this->postJson('/api/auth/login', [
        'email' => 'user@test.com',
        'password' => 'Password@123',
    ])->assertStatus(200)
        ->assertJsonStructure(['data', 'token']);
});

it('rejects login with invalid credentials', function () {
    User::factory()->create(['email' => 'user@test.com']);

    $this->postJson('/api/auth/login', [
        'email' => 'user@test.com',
        'password' => 'WrongPassword',
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});

it('rejects login for inactive account', function () {
    $user = User::factory()->create([
        'email' => 'inactive@test.com',
        'password' => Hash::make('Password@123'),
        'is_active' => false,
    ]);

    $this->postJson('/api/auth/login', [
        'email' => 'inactive@test.com',
        'password' => 'Password@123',
    ])->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});

it('logs out successfully', function () {
    $user = User::factory()->create(['is_active' => true]);
    $token = $user->createToken('test')->plainTextToken;

    $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson('/api/auth/logout')
        ->assertStatus(200)
        ->assertJson(['message' => 'Logged out successfully.']);
});
