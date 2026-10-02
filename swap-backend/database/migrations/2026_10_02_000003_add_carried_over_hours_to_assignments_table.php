<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Unfinished promissory makeup hours move into the next term when a renewal rolls the
 * student over: the new requirement is the base plus these hours, and the source term
 * is kept so the UI can say "200 + 6 carried over from 1st Semester 2025-2026".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->unsignedInteger('carried_over_hours')->default(0)->after('required_hours');
            $table->foreignId('carried_from_assignment_id')->nullable()->after('carried_over_hours')
                ->constrained('assignments')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('carried_from_assignment_id');
            $table->dropColumn('carried_over_hours');
        });
    }
};
