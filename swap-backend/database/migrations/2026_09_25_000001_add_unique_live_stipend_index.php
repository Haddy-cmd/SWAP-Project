<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * At most one live stipend (pending / certified / claimed / legacy released) per
 * recipient per academic period — the database backstop behind the release
 * guards in StipendClaimService, so two concurrent releases can't double-pay.
 * A voided stub frees the period again, hence the partial index.
 *
 * Refuses to run while duplicates exist rather than deleting any: which row is
 * the real payment is an admin decision (void the other one, then re-deploy).
 */
return new class extends Migration
{
    private const INDEX = 'stipend_history_one_live_per_period';

    private const LIVE = "status IN ('pending', 'certified', 'claimed', 'released')";

    public function up(): void
    {
        if (!in_array(DB::getDriverName(), ['pgsql', 'sqlite'], true)) {
            return; // Partial indexes: Postgres (prod + tests) and SQLite only.
        }

        $duplicates = DB::select(
            'SELECT user_id, academic_year, semester, COUNT(*) AS live_rows
               FROM stipend_history
              WHERE ' . self::LIVE . '
           GROUP BY user_id, academic_year, semester
             HAVING COUNT(*) > 1'
        );

        if ($duplicates) {
            $list = collect($duplicates)
                ->map(fn ($d) => "user {$d->user_id} {$d->academic_year} {$d->semester} ({$d->live_rows} rows)")
                ->join('; ');

            throw new RuntimeException(
                "Cannot enforce one live stipend per period — void the extra rows first: {$list}"
            );
        }

        DB::statement(
            'CREATE UNIQUE INDEX ' . self::INDEX . ' ON stipend_history (user_id, academic_year, semester) WHERE ' . self::LIVE
        );
    }

    public function down(): void
    {
        if (in_array(DB::getDriverName(), ['pgsql', 'sqlite'], true)) {
            DB::statement('DROP INDEX IF EXISTS ' . self::INDEX);
        }
    }
};
