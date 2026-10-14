<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Announcements choose who they reach: everyone (recipients + supervisors), one office
 * (its students and supervisors), recipients only, or supervisors only. Every earlier
 * announcement went to the active recipients, so they keep `recipients`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->string('audience', 20)->default('recipients')->after('message');
            $table->foreignId('office_id')->nullable()->after('audience')->constrained('offices')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('office_id');
            $table->dropColumn('audience');
        });
    }
};
