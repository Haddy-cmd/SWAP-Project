<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Email verification is being introduced. Mark all EXISTING accounts as
     * verified so nobody is locked out — only NEW registrations from here on
     * must confirm their email before signing in.
     */
    public function up(): void
    {
        DB::table('users')->whereNull('email_verified_at')->update(['email_verified_at' => now()]);
    }

    public function down(): void
    {
        // No-op: we can't know which accounts were unverified before the backfill.
    }
};
