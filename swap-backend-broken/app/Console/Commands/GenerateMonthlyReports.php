<?php

namespace App\Console\Commands;

use App\Jobs\GenerateMonthlyReportJob;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class GenerateMonthlyReports extends Command
{
    protected $signature = 'swap:generate-monthly-reports
        {academic_year : Academic year (e.g. 2024-2025)}
        {semester : Semester (e.g. "1st Semester")}
        {--month= : Month number 1-12 (defaults to last month)}
        {--year= : Year (defaults to current year)}';

    protected $description = 'Generate monthly attendance reports for all active recipients';

    public function handle(): int
    {
        $lastMonth = Carbon::now()->subMonth();
        $month = (int) ($this->option('month') ?? $lastMonth->month);
        $year = (int) ($this->option('year') ?? $lastMonth->year);

        $this->info("Dispatching monthly report for {$month}/{$year}...");

        GenerateMonthlyReportJob::dispatch(
            $this->argument('academic_year'),
            $this->argument('semester'),
            $month,
            $year
        )->onQueue('reports');

        $this->info('Monthly report generation job dispatched.');

        return Command::SUCCESS;
    }
}
