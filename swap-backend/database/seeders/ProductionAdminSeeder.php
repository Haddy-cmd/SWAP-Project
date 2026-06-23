<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Ensures an admin account exists in production without needing shell access.
 * Runs on every deploy (idempotent — only creates the admin if it's missing).
 * Override the credentials with ADMIN_EMAIL / ADMIN_PASSWORD env vars.
 */
class ProductionAdminSeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => env('ADMIN_EMAIL', 'admin@msumarawi.edu.ph')],
            [
                'name' => 'DSA Admin',
                'password' => env('ADMIN_PASSWORD', 'SwapAdmin2024'),
                'role' => 'admin',
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );
    }
}
