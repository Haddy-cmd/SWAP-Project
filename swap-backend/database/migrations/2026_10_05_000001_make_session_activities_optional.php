<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The clock-out note's Task Description (`content`) is now required to clock out and
 * prints on the duty slip; "Specific activities done" became optional. Older notes
 * keep theirs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('narrative_reports', function (Blueprint $table) {
            $table->text('activities_done')->nullable()->change();
        });
    }

    public function down(): void
    {
        DB::table('narrative_reports')->whereNull('activities_done')->update(['activities_done' => '']);

        Schema::table('narrative_reports', function (Blueprint $table) {
            $table->text('activities_done')->nullable(false)->change();
        });
    }
};
