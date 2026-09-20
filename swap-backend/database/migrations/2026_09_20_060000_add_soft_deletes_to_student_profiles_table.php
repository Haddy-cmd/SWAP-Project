<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Users are soft-deleted, but their student_profiles row stayed live — so both
     * `unique:student_profiles,student_id_number` and the unique index behind it
     * kept counting the profile of a deleted account, and nobody could ever
     * re-register with that student ID.
     *
     * Give profiles their own soft-delete flag, backfill it from the owning user,
     * and narrow the unique index to rows that are still live.
     */
    public function up(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->softDeletes();
        });

        DB::statement('
            UPDATE student_profiles sp
            SET deleted_at = u.deleted_at
            FROM users u
            WHERE u.id = sp.user_id AND u.deleted_at IS NOT NULL
        ');

        // A unique CONSTRAINT cannot be partial, so swap it for a partial unique INDEX.
        DB::statement('ALTER TABLE student_profiles DROP CONSTRAINT IF EXISTS student_profiles_student_id_number_unique');
        DB::statement('
            CREATE UNIQUE INDEX student_profiles_student_id_number_unique
            ON student_profiles (student_id_number)
            WHERE deleted_at IS NULL
        ');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS student_profiles_student_id_number_unique');

        // Restoring a full constraint needs the duplicates gone first.
        DB::statement('DELETE FROM student_profiles WHERE deleted_at IS NOT NULL');
        DB::statement('ALTER TABLE student_profiles ADD CONSTRAINT student_profiles_student_id_number_unique UNIQUE (student_id_number)');

        Schema::table('student_profiles', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
