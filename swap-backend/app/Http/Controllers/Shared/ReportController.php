<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use App\Services\StipendService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    public function generateAdminReport(Request $request): JsonResponse
    {
        $request->validate([
            'type' => ['required', 'string', 'in:weekly,monthly,semester'],
            'academic_year' => ['required', 'string'],
            'semester' => ['required', 'string'],
        ]);

        return response()->json([
            'data' => ['message' => 'Report generation queued. You will be notified when ready.'],
        ]);
    }
}
