<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Analytics\RemindSupervisorsRequest;
use App\Services\AnalyticsService;
use App\Services\ProgramInsightsService;
use App\Services\SupervisorReminderService;
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

    /** Supervisors tab: remind the busy supervisors (at most once a day each). */
    public function remindSupervisors(RemindSupervisorsRequest $request, SupervisorReminderService $reminders): JsonResponse
    {
        $data = $request->validated();

        return response()->json(['data' => $reminders->remindBusy($data['academic_year'], $data['semester'], $request->user())]);
    }

    public function periods(): JsonResponse
    {
        return response()->json(['data' => $this->analyticsService->getAvailablePeriods()]);
    }
}
