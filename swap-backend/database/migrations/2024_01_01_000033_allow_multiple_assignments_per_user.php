<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A recipient originally had exactly one assignment (unique user_id). With
     * semester renewals, each term gets its own assignment row so hours and
     * history stay attached to the period they belong to. "One ACTIVE at a
     * time" is enforced in the application layer (rollover completes the old
     * assignment before creating the next).
     */
    public function up(): void
    {
        // A plain assignments_user_id_index already exists for lookups.
        Schema::table('assignments', function (Blueprint $table) {
            $table->dropUnique('assignments_user_id_unique');
        });
    }

    public function down(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->unique('user_id');
        });
    }
};
