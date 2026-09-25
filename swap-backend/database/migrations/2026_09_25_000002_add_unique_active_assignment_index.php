<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * At most one ACTIVE assignment per recipient per term. The original unique
 * index was dropped (2024_01_01_000033) so completed terms could coexist with a
 * new one; this partial index keeps that while stopping a double-submitted
 * "Assign" from creating two live placements (and two QR codes).
 *
 * Refuses to run while duplicates exist rather than guessing which to close.
 */
return new class extends Migration
{
    private const INDEX = 'assignments_one_active_per_term';

    public function up(): void
    {
        if (!in_array(DB::getDriverName(), ['pgsql', 'sqlite'], true)) {
            return;
        }

        $duplicates = DB::select(
            "SELECT user_id, academic_year, semester, COUNT(*) AS active_rows
               FROM assignments
              WHERE status = 'active'
           GROUP BY user_id, academic_year, semester
             HAVING COUNT(*) > 1"
        );

        if ($duplicates) {
            $list = collect($duplicates)
                ->map(fn ($d) => "user {$d->user_id} {$d->academic_year} {$d->semester} ({$d->active_rows} rows)")
                ->join('; ');

            throw new RuntimeException(
                "Cannot enforce one active assignment per term — complete or remove the extras first: {$list}"
            );
        }

        DB::statement(
            "CREATE UNIQUE INDEX " . self::INDEX . " ON assignments (user_id, academic_year, semester) WHERE status = 'active'"
        );
    }

    public function down(): void
    {
        if (in_array(DB::getDriverName(), ['pgsql', 'sqlite'], true)) {
            DB::statement('DROP INDEX IF EXISTS ' . self::INDEX);
        }
    }
};
