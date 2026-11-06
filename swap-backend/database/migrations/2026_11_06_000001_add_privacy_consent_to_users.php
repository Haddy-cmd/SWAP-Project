<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When an account holder agreed to the Privacy Notice (RA 10173), and which version.
 * Accounts made before the notice existed stay null.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('privacy_accepted_at')->nullable()->after('email_verified_at');
            $table->string('privacy_version', 20)->nullable()->after('privacy_accepted_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['privacy_accepted_at', 'privacy_version']);
        });
    }
};
