<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * A recipient whose renewal is rejected goes back to being an applicant and may apply
 * again — possibly for the same semester the renewal was for. One application per
 * student per semester still holds, but a rejected renewal no longer counts toward it.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_user_id_academic_year_semester_unique');
        DB::statement("CREATE UNIQUE INDEX applications_one_per_term_unique ON applications (user_id, academic_year, semester)
            WHERE NOT (type = 'renewal' AND status = 'rejected')");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS applications_one_per_term_unique');
        DB::statement('ALTER TABLE applications ADD CONSTRAINT applications_user_id_academic_year_semester_unique UNIQUE (user_id, academic_year, semester)');
    }
};
