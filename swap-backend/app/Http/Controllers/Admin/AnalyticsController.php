<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\AnalyticsService;
use App\Services\ProgramInsightsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    public function __construct(private readonly AnalyticsService $analyticsService) {}

    public function overview(Request $request): JsonResponse
    {
        $request->validate([
            'academic_year' => ['required', 'string'],
            'semester' => ['required', 'string'],
        ]);

        $overview = $this->analyticsService->getAdminOverview(
            $request->academic_year,
            $request->semester
        );

        return response()->json(['data' => $overview]);
    }

    /** Program insights for one term: results, renewals, money, integrity, workload, funnel, offices. */
    public function insights(Request $request, ProgramInsightsService $insights): JsonResponse
    {
        $data = $request->validate([
            'academic_year' => ['required', 'string'],
            'semester' => ['required', 'string'],
        ]);

        return response()->json(['data' => $insights->forTerm($data['academic_year'], $data['semester'])]);
    }

    public function periods(): JsonResponse
    {
        return response()->json(['data' => $this->analyticsService->getAvailablePeriods()]);
    }

    public function auditLogs(Request $request): JsonResponse
    {
        $logs = AuditLog::with('user')
            ->orderByDesc('created_at')
            ->paginate(15);

        return response()->json([
            'data' => $logs->items(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'total' => $logs->total(),
            ],
        ]);
    }
}
