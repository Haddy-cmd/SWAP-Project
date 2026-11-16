<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Time a recipient spent outside the office premises during a shift (they left and came back).
 * It doesn't count: the generated duration_hours is now (time_out − time_in − away). The column
 * is re-created rather than altered so it works on every PostgreSQL version; PostgreSQL
 * recomputes it for every row (existing logs have 0 away, so their hours don't change).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE time_logs ADD COLUMN away_seconds INTEGER NOT NULL DEFAULT 0');
        DB::statement('ALTER TABLE time_logs DROP COLUMN duration_hours');
        DB::statement(
            'ALTER TABLE time_logs ADD COLUMN duration_hours NUMERIC(6,2) GENERATED ALWAYS AS '
            . '(ROUND(GREATEST(EXTRACT(EPOCH FROM (time_out - time_in)) - away_seconds, 0) / 3600, 2)) STORED'
        );
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE time_logs DROP COLUMN duration_hours');
        DB::statement(
            'ALTER TABLE time_logs ADD COLUMN duration_hours NUMERIC(6,2) GENERATED ALWAYS AS '
            . '(ROUND(EXTRACT(EPOCH FROM (time_out - time_in)) / 3600, 2)) STORED'
        );
        DB::statement('ALTER TABLE time_logs DROP COLUMN away_seconds');
    }
};
