<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * System Testing now works on existing accounts only (users.testing_added_at), with their
 * real email: the made-up test accounts, their shared password and their email inbox
 * setting are gone. Any test account still left is deactivated so it can't sign in.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'is_test_account')) {
            DB::table('users')->where('is_test_account', true)->update(['is_active' => false]);

            Schema::table('users', function (Blueprint $table) {
                $table->dropIndex(['is_test_account']);
                $table->dropColumn('is_test_account');
            });
        }

        DB::table('settings')->whereIn('key', ['test_tools_password', 'test_tools_mail_to'])->delete();
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_test_account')->default(false)->after('is_active');
            $table->index('is_test_account');
        });
    }
};
