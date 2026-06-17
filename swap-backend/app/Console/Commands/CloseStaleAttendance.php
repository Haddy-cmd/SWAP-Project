<?php

namespace App\Console\Commands;

use App\Models\TimeLog;
use App\Services\AttendanceService;
use Illuminate\Console\Command;

class CloseStaleAttendance extends Command
{
    protected $signature = 'attendance:close-stale {--hours=12 : Max session length in hours before a log is force-closed}';

    protected $description = 'Safety net: auto-close attendance logs left open beyond the max session length.';

    public function handle(AttendanceService $attendanceService): int
    {
        $maxHours = max(1, (int) $this->option('hours'));
        $cutoff = now()->subHours($maxHours);

        $stale = TimeLog::with(['user', 'assignment'])
            ->where('status', 'open')
            ->where('time_in', '<', $cutoff)
            ->get();

        foreach ($stale as $log) {
            $attendanceService->closeStaleLog($log, $maxHours);
            $this->line("Closed log #{$log->id} (user {$log->user_id}, open since {$log->time_in}).");
        }

        $this->info("Closed {$stale->count()} stale attendance log(s) past {$maxHours}h.");

        return self::SUCCESS;
    }
}
