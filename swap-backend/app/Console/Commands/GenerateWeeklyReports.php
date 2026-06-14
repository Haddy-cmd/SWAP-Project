<?php

namespace App\Console\Commands;

use App\Jobs\GenerateWeeklyReportJob;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class GenerateWeeklyReports extends Command
{
    protected $signature = 'swap:generate-weekly-reports
        {academic_year : Academic year (e.g. 2024-2025)}
        {semester : Semester (e.g. "1st Semester")}
        {--week= : Week number (defaults to current week of year)}';

    protected $description = 'Generate weekly attendance reports for all active recipients';

    public function handle(): int
    {
        $weekNumber = (int) ($this->option('week') ?? Carbon::now()->weekOfYear);

        $this->info("Dispatching weekly report generation for week {$weekNumber}...");

        GenerateWeeklyReportJob::dispatch(
            $this->argument('academic_year'),
            $this->argument('semester'),
            $weekNumber
        )->onQueue('reports');

        $this->info('Weekly report generation job dispatched.');

        return Command::SUCCESS;
    }
}
