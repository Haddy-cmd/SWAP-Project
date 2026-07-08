<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The standard SWAP service requirement is 200 hours per semester. Change the
     * column defaults from 120 to 200 (existing rows keep their own value).
     *
     * Uses raw ALTER … SET DEFAULT rather than Schema ->change(): semester_reports
     * .required_hours feeds a generated column (completion_rate), and altering the
     * column type is rejected by Postgres — but changing only the default is fine.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE assignments ALTER COLUMN required_hours SET DEFAULT 200');
        DB::statement('ALTER TABLE semester_reports ALTER COLUMN required_hours SET DEFAULT 200');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE assignments ALTER COLUMN required_hours SET DEFAULT 120');
        DB::statement('ALTER TABLE semester_reports ALTER COLUMN required_hours SET DEFAULT 120');
    }
};
