<?php

namespace App\Console\Commands;

use App\Services\AttendanceService;
use Illuminate\Console\Command;

class DedupOpenAttendance extends Command
{
    protected $signature = 'attendance:dedup-open';

    protected $description = 'Void duplicate/overlapping open attendance logs so each recipient has at most one live session.';

    public function handle(AttendanceService $attendanceService): int
    {
        $voided = $attendanceService->voidDuplicateOpenLogs();

        $this->info("Voided {$voided} duplicate open attendance log(s).");

        return self::SUCCESS;
    }
}
