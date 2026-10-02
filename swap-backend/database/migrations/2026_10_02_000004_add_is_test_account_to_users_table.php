<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Accounts made by Admin → System Testing. Only they get the testing shortcuts and
 * rule bypasses (and only while SWAP_TEST_TOOLS is on); they are left out of analytics,
 * reports and email, and "Delete all test data" removes them with everything they own.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_test_account')->default(false)->after('is_active');
            $table->index('is_test_account');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['is_test_account']);
            $table->dropColumn('is_test_account');
        });
    }
};
