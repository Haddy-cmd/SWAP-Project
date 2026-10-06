<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use App\Services\StipendService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Stipend history and the supervisor's insights. The report tables and their
 * PDF/CSV downloads live in ReportExplorerController.
 */
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

    /** Verification queue, own turnaround, inactive students and automatic clock-outs. */
    public function supervisorInsights(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->reportService->supervisorInsights($request->user())]);
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
}
