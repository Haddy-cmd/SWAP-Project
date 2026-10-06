<?php

namespace App\Services;

use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;

/**
 * Renders an Analytics & Reports result as a downloadable PDF: DSA letterhead, the
 * filters that were applied, the KPI tiles, the chart as CSS bars (dompdf runs no
 * JavaScript) and the full table. Rendered on request and not stored — reports
 * are views of live data, not records.
 */
class ReportPdfService
{
    /** Wider tables than this print landscape. */
    private const PORTRAIT_MAX_COLUMNS = 7;

    public function render(array $report, User $by): string
    {
        $landscape = count($report['columns']) > self::PORTRAIT_MAX_COLUMNS;

        return Pdf::loadView('reports.report', [
            'report' => $report,
            'preparedBy' => $by->profile?->full_name ?? $by->name,
            'generatedAt' => now('Asia/Manila')->format('F j, Y g:i A'),
        ])->setPaper('a4', $landscape ? 'landscape' : 'portrait')->output();
    }

    /** The admin's term overview: KPIs plus the program insights, on one or two pages. */
    public function renderOverview(array $overview, array $insights, string $term, User $by): string
    {
        return Pdf::loadView('reports.overview', [
            'o' => $overview,
            'i' => $insights,
            'term' => $term,
            'preparedBy' => $by->profile?->full_name ?? $by->name,
            'generatedAt' => now('Asia/Manila')->format('F j, Y g:i A'),
        ])->setPaper('a4', 'portrait')->output();
    }

    /** One table cell as the PDF prints it. */
    public static function cell(mixed $value, string $type): string
    {
        if ($value === null || $value === '') {
            return '—';
        }

        return match ($type) {
            'money' => '₱' . number_format((float) $value, 2),
            'hours' => rtrim(rtrim(number_format((float) $value, 2), '0'), '.'),
            'percent' => rtrim(rtrim(number_format((float) $value, 1), '0'), '.') . '%',
            default => (string) $value,
        };
    }
}
