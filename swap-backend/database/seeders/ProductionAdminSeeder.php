<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Log;

/**
 * Ensures an admin account exists in production without needing shell access.
 * Runs on every deploy (idempotent — only creates the admin if it's missing).
 * Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD (set as secrets on the host).
 */
class ProductionAdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('ADMIN_EMAIL');
        $password = env('ADMIN_PASSWORD');

        if (!$email || !$password) {
            // Never fall back to a password that lives in the repo on a real deploy.
            // Skipping (rather than failing) keeps boot working when an admin
            // already exists; set the vars to bootstrap a fresh database.
            if (app()->environment('production')) {
                $message = 'ProductionAdminSeeder skipped: ADMIN_EMAIL / ADMIN_PASSWORD are not set.';
                Log::warning($message);
                $this->command?->warn($message);

                return;
            }

            $email ??= 'admin@msumarawi.edu.ph';
            $password ??= 'SwapAdmin2024';
        }

        User::firstOrCreate(
            ['email' => $email],
            [
                'name' => 'DSA Admin',
                'password' => $password,
                'role' => 'admin',
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );
    }
}
