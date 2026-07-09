<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use App\Services\StipendService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function __construct(
        private readonly ReportService $reportService,
        private readonly StipendService $stipendService
    ) {}

    public function weekly(Request $request): JsonResponse
    {
        $reports = $this->reportService->getWeeklyReports($request->user());

        return response()->json(['data' => $reports]);
    }

    public function monthly(Request $request): JsonResponse
    {
        $reports = $this->reportService->getMonthlyReports($request->user());

        return response()->json(['data' => $reports]);
    }

    public function semester(Request $request): JsonResponse
    {
        $report = $this->reportService->getSemesterReport($request->user());

        return response()->json(['data' => $report]);
    }

    public function stipendHistory(Request $request): JsonResponse
    {
        $history = $this->stipendService->getHistory($request->user());

        return response()->json([
            'data' => $history->items(),
            'meta' => [
                'current_page' => $history->currentPage(),
                'last_page' => $history->lastPage(),
                'total' => $history->total(),
            ],
        ]);
    }

    public function previewAdminReport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', 'string', 'in:applications,recipients,stipend,offices'],
            'academic_year' => ['required', 'string'],
            'semester' => ['required', 'string'],
        ]);

        $data = $this->reportService->adminReportData(
            $validated['type'],
            $validated['academic_year'],
            $validated['semester']
        );

        return response()->json(['data' => [
            'title' => $data['title'],
            'headers' => $data['headers'],
            'rows' => $data['rows'],
            'stats' => $data['stats'],
        ]]);
    }

    public function generateAdminReport(Request $request): StreamedResponse
    {
        $validated = $request->validate([
            'type' => ['required', 'string', 'in:applications,recipients,stipend,offices'],
            'academic_year' => ['required', 'string'],
            'semester' => ['required', 'string'],
        ]);

        $report = $this->reportService->buildAdminExport(
            $validated['type'],
            $validated['academic_year'],
            $validated['semester']
        );

        return $this->streamCsv($report);
    }

    /** Live preview of the supervisor's end-of-semester roster summary. */
    public function supervisorRoster(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->reportService->supervisorRosterData($request->user()),
        ]);
    }

    /** The same roster as a CSV the supervisor can hand to the DSA. */
    public function exportSupervisorRoster(Request $request): StreamedResponse
    {
        return $this->streamCsv($this->reportService->buildSupervisorExport($request->user()));
    }

    /** @param array{headers:array,rows:array,filename:string} $report */
    private function streamCsv(array $report): StreamedResponse
    {
        return response()->streamDownload(function () use ($report) {
            $out = fopen('php://output', 'w');
            // UTF-8 BOM so Excel renders accented characters correctly.
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, $report['headers']);
            foreach ($report['rows'] as $row) {
                fputcsv($out, $row);
            }
            fclose($out);
        }, $report['filename'], [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
