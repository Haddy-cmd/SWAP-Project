<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
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

    public function stipendHistory(Request $request): JsonResponse
    {
        // The recipient page lists every stub at once (and totals them), so it asks
        // for a large page; capped so the query stays bounded.
        $validated = $request->validate(['per_page' => ['sometimes', 'integer', 'min:1', 'max:100']]);
        $history = $this->stipendService->getHistory($request->user(), (int) ($validated['per_page'] ?? 15));

        return response()->json([
            'data' => \App\Resources\StipendResource::collection($history->items()),
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

        // Exports carry personal data out of the system — record who took what.
        AuditLog::record('report_exported', $request->user(), null, $validated + ['rows' => count($report['rows'])]);

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
        $report = $this->reportService->buildSupervisorExport($request->user());
        AuditLog::record('report_exported', $request->user(), null, ['type' => 'supervisor_roster', 'rows' => count($report['rows'])]);

        return $this->streamCsv($report);
    }

    /**
     * Names, emails and remarks are user-typed. A cell starting with = + - @ (or a
     * tab/CR) is run as a formula by Excel/Sheets — e.g. a name like
     * =HYPERLINK(...). Prefixing an apostrophe makes the spreadsheet show it as text.
     * Numbers the report itself produced (amounts, hours) are left untouched.
     */
    public static function csvSafe(mixed $cell): mixed
    {
        if (!is_string($cell) || $cell === '' || is_numeric($cell)) {
            return $cell;
        }

        return in_array($cell[0], ['=', '+', '-', '@', "\t", "\r"], true) ? "'" . $cell : $cell;
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
                fputcsv($out, array_map([self::class, 'csvSafe'], $row));
            }
            fclose($out);
        }, $report['filename'], [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
