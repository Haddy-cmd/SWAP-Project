<?php

namespace App\Services;

use App\Reports\Datasets\ApplicationsDataset;
use App\Reports\Datasets\MyTermsDataset;
use App\Reports\Datasets\OfficesDataset;
use App\Reports\Datasets\RecipientsDataset;
use App\Reports\Datasets\RosterDataset;
use App\Reports\Datasets\StipendDataset;
use App\Reports\Datasets\TermResultsDataset;
use App\Reports\Datasets\TimeLogsDataset;
use App\Reports\ReportDataset;
use App\Reports\ReportScope;
use App\Support\ReportQuery;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Analytics & Reports: which reports each role may open, and one run() that both
 * the screen and the downloads read, so a PDF or CSV holds exactly the filtered,
 * sorted rows the viewer was looking at.
 */
class ReportExplorerService
{
    /** dompdf slows down sharply past this; larger exports go to CSV. */
    public const PDF_ROW_LIMIT = 2000;

    private const DATASETS = [
        'admin' => [
            'applications' => ApplicationsDataset::class,
            'recipients' => RecipientsDataset::class,
            'term-results' => TermResultsDataset::class,
            'stipend' => StipendDataset::class,
            'offices' => OfficesDataset::class,
        ],
        'supervisor' => [
            'roster' => RosterDataset::class,
            'term-results' => TermResultsDataset::class,
        ],
        'recipient' => [
            'time-logs' => TimeLogsDataset::class,
            'terms' => MyTermsDataset::class,
        ],
    ];

    /** The dataset for this viewer's role, or 404 for a type their role doesn't have. */
    public function dataset(string $type, ReportScope $scope): ReportDataset
    {
        $class = self::DATASETS[$scope->user->role][$type] ?? null;
        if ($class === null) {
            throw new NotFoundHttpException('Report not found.');
        }

        return new $class($scope);
    }

    /** @return array<string, mixed> */
    public function run(ReportDataset $dataset, ReportQuery $query, ReportScope $scope): array
    {
        $columns = $dataset->columns();
        $all = $dataset->rows()->values();
        $rows = $query->apply($all, $columns);

        return [
            'title' => $dataset->title(),
            'slug' => $dataset->slug(),
            'term' => $scope->termLabel(),
            'columns' => $columns,
            'rows' => $rows->all(),
            'total_rows' => $all->count(),
            'stats' => $dataset->stats($rows),
            'facets' => $query->facets($all, $columns),
            'group_by' => $query->groupBy,
            'metric' => $query->metric,
            'groups' => $query->groups($rows),
            'filters_applied' => $query->describe($columns),
            'meta' => $dataset->meta(),
        ];
    }

    /** `{slug}-{term}-{date}.{ext}`, e.g. term-results-2025-2026-1stsemester-20261006.pdf */
    public function filename(array $report, ReportScope $scope, string $ext): string
    {
        $term = $scope->hasTerm()
            ? '-' . $scope->academicYear . '-' . str_replace(' ', '', strtolower($scope->semester))
            : '';

        return "{$report['slug']}{$term}-" . now('Asia/Manila')->format('Ymd') . ".{$ext}";
    }
}
