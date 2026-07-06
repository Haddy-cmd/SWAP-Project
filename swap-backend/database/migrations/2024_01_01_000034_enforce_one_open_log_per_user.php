<?php

use App\Services\AttendanceService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Guarantee a recipient can never have more than one open (not-clocked-out)
     * attendance log. A non-atomic, today-only clock-in guard previously let a
     * double-tap create two open logs — clocking out one left the other counting
     * forever. First void any existing duplicates, then add a partial unique index
     * so the database itself rejects a second open log.
     */
    public function up(): void
    {
        // Resolve current duplicates so the unique index can be created.
        app(AttendanceService::class)->voidDuplicateOpenLogs();

        DB::statement(
            "CREATE UNIQUE INDEX IF NOT EXISTS time_logs_one_open_per_user
             ON time_logs (user_id) WHERE status = 'open'"
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS time_logs_one_open_per_user');
    }
};
