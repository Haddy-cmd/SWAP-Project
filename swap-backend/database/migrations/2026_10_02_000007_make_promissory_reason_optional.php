<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The promissory document itself carries the student's explanation, so the separate
 * "reason" text is no longer asked for on the form. Older notes keep theirs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promissory_notes', function (Blueprint $table) {
            $table->text('reason')->nullable()->change();
        });
    }

    public function down(): void
    {
        DB::table('promissory_notes')->whereNull('reason')->update(['reason' => '']);

        Schema::table('promissory_notes', function (Blueprint $table) {
            $table->text('reason')->nullable(false)->change();
        });
    }
};
