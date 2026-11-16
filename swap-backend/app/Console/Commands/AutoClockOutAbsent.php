<?php

namespace App\Console\Commands;

use App\Models\TimeLog;
use App\Services\AttendanceService;
use Illuminate\Console\Command;

class AutoClockOutAbsent extends Command
{
    protected $signature = 'attendance:auto-clock-out';

    protected $description = 'Clock out recipients who left their office premises more than the grace period ago (even with the app closed).';

    public function handle(AttendanceService $attendanceService): int
    {
        $due = TimeLog::with(['assignment.office'])
            ->where('status', 'open')
            ->whereNotNull('left_premises_at')
            ->where('left_premises_at', '<=', now()->subMinutes(AttendanceService::AUTO_CLOCK_OUT_GRACE_MINUTES))
            ->get();

        $closed = 0;
        foreach ($due as $log) {
            if ($attendanceService->closeOverdueAbsence($log)) {
                $closed++;
                $this->line("Clocked out log #{$log->id} (user {$log->user_id}, away since {$log->left_premises_at}).");
            }
        }
        $this->info("Clocked out {$closed} recipient(s) who left the premises.");

        return self::SUCCESS;
    }
}
