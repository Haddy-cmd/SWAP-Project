<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReportQueryRequest;
use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\SemesterPeriod;
use App\Reports\ReportDataset;
use App\Reports\ReportScope;
use App\Services\AnalyticsService;
use App\Services\ProgramInsightsService;
use App\Services\ReportExplorerService;
use App\Services\ReportPdfService;
use App\Support\ReportQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Analytics & Reports for every role. The route group's role middleware decides who
 * gets in; ReportExplorerService decides which reports that role has, and each
 * dataset narrows its rows to what the viewer may see.
 */
class ReportExplorerController extends Controller
{
    public function __construct(
        private readonly ReportExplorerService $explorer,
        private readonly ReportPdfService $pdf,
    ) {}

    public function show(ReportQueryRequest $request, string $type): JsonResponse
    {
        [$dataset, $query, $scope] = $this->resolve($request, $type);

        return response()->json(['data' => $this->explorer->run($dataset, $query, $scope)]);
    }

    /** The filtered, sorted rows on screen as a PDF or CSV. */
    public function export(ReportQueryRequest $request, string $type): Response|StreamedResponse|JsonResponse
    {
        [$dataset, $query, $scope] = $this->resolve($request, $type);
        $format = $request->validated('format') ?? 'pdf';
        $report = $this->explorer->run($dataset, $query, $scope);

        if ($format === 'pdf' && count($report['rows']) > ReportExplorerService::PDF_ROW_LIMIT) {
            return response()->json([
                'message' => 'This report has ' . count($report['rows']) . ' rows — too many for a PDF (limit ' . ReportExplorerService::PDF_ROW_LIMIT . '). Narrow the filters or download the CSV.',
            ], 422);
        }

        // Exports carry personal data out of the system — record who took what.
        AuditLog::record('report_exported', $request->user(), null, [
            'type' => $type,
            'format' => $format,
            'term' => $scope->termLabel(),
            'rows' => count($report['rows']),
        ] + $query->toArray());

        $filename = $this->explorer->filename($report, $scope, $format);

        if ($format === 'csv') {
            return $this->streamCsv($report, $filename);
        }

        return response($this->pdf->render($report, $request->user()), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /** Supervisor: the terms their students (now or before) were placed in, newest first. */
    public function supervisorPeriods(Request $request): JsonResponse
    {
        $periods = Assignment::visibleToSupervisor($request->user())
            ->select('academic_year', 'semester')->distinct()->get()
            ->map(fn ($r) => ['academic_year' => $r->academic_year, 'semester' => $r->semester])
            // Year desc, then the later semester first within a year.
            ->sortByDesc(fn ($p) => $p['academic_year'] . '|' . array_search($p['semester'], SemesterPeriod::SEMESTERS, true))
            ->values()->all();

        return response()->json(['data' => $periods]);
    }

    /** Admin: the term's KPIs and program insights as one PDF. */
    public function overviewPdf(Request $request, AnalyticsService $analytics, ProgramInsightsService $insights): Response
    {
        $data = $request->validate([
            'academic_year' => ['required', 'string', 'regex:/^\d{4}-\d{4}$/'],
            'semester' => ['required', 'string', Rule::in(SemesterPeriod::SEMESTERS)],
        ]);
        $term = "{$data['semester']} {$data['academic_year']}";

        AuditLog::record('report_exported', $request->user(), null, ['type' => 'overview', 'format' => 'pdf', 'term' => $term]);

        $pdf = $this->pdf->renderOverview(
            $analytics->getAdminOverview($data['academic_year'], $data['semester']),
            $insights->forTerm($data['academic_year'], $data['semester']),
            $term,
            $request->user(),
        );
        $sem = str_replace(' ', '', strtolower($data['semester']));

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "attachment; filename=\"program-overview-{$data['academic_year']}-{$sem}-" . now('Asia/Manila')->format('Ymd') . '.pdf"',
        ]);
    }

    /** @return array{0: ReportDataset, 1: ReportQuery, 2: ReportScope} */
    private function resolve(ReportQueryRequest $request, string $type): array
    {
        $input = $request->validated();
        $scope = new ReportScope($request->user(), $input['academic_year'] ?? null, $input['semester'] ?? null);
        $dataset = $this->explorer->dataset($type, $scope);

        if ($dataset->needsTerm() && !$scope->hasTerm()) {
            throw ValidationException::withMessages(['academic_year' => ['Choose a school year and semester for this report.']]);
        }

        return [$dataset, ReportQuery::fromInput($input, $dataset->columns(), $dataset->defaultGroup()), $scope];
    }

    /** Columns in report order, labels as the header; cells through csvSafe(). */
    private function streamCsv(array $report, string $filename): StreamedResponse
    {
        $keys = array_column($report['columns'], 'key');

        return response()->streamDownload(function () use ($report, $keys) {
            $out = fopen('php://output', 'w');
            // UTF-8 BOM so Excel renders accented characters (and ₱) correctly.
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, array_column($report['columns'], 'label'));
            foreach ($report['rows'] as $row) {
                fputcsv($out, array_map(fn ($k) => ReportController::csvSafe($row[$k] ?? null), $keys));
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
