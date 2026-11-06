<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Analytics\RemindSupervisorsRequest;
use App\Services\AnalyticsService;
use App\Services\ProgramInsightsService;
use App\Services\SupervisorReminderService;
use App\Support\TermScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    public function __construct(private readonly AnalyticsService $analyticsService) {}

    public function overview(Request $request): JsonResponse
    {
        // No term: every semester (Analytics → "All semesters").
        $data = $request->validate(TermScope::rules());

        $overview = $this->analyticsService->getAdminOverview($data['academic_year'] ?? null, $data['semester'] ?? null);

        return response()->json(['data' => $overview]);
    }

    /** Program insights for one term, or every term: results, renewals, money, integrity, workload, funnel, offices. */
    public function insights(Request $request, ProgramInsightsService $insights): JsonResponse
    {
        $data = $request->validate(TermScope::rules());

        return response()->json(['data' => $insights->forTerm($data['academic_year'] ?? null, $data['semester'] ?? null)]);
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
