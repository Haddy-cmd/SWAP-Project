<?php

namespace App\Jobs;

use App\Models\Assignment;
use App\Services\ReportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class GenerateMonthlyReportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public function __construct(
        private readonly string $academicYear,
        private readonly string $semester,
        private readonly int $month,
        private readonly int $year
    ) {}

    public function handle(ReportService $reportService): void
    {
        Assignment::with('user')
            ->where('academic_year', $this->academicYear)
            ->where('semester', $this->semester)
            ->where('status', 'active')
            ->chunk(50, function ($assignments) use ($reportService) {
                foreach ($assignments as $assignment) {
                    $reportService->generateMonthlyReport(
                        $assignment->user,
                        $this->academicYear,
                        $this->semester,
                        $this->month,
                        $this->year
                    );
                }
            });
    }
}
