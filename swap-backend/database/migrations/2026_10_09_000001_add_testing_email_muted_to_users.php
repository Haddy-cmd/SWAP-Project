<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Admin → System Testing: each picked account has its own email switch, off by default, so its
 * inbox gets no notification emails while it is being tested (bell notifications still arrive).
 * Replaces the page-wide `test_email_muted` setting.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('testing_email_muted')->default(true)->after('testing_added_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('testing_email_muted');
        });
    }
};
