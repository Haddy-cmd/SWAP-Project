<?php

namespace App\Http\Controllers\Recipient;

use App\Http\Controllers\Controller;
use App\Services\AttendanceService;
use App\Services\RecipientProgressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HoursController extends Controller
{
    public function __construct(private readonly AttendanceService $attendanceService) {}

    public function summary(Request $request): JsonResponse
    {
        $summary = $this->attendanceService->getHoursSummary($request->user());

        return response()->json(['data' => $summary]);
    }

    /** Pace, forecast, hours breakdown and the stipend/renewal checklist for the current placement. */
    public function progress(Request $request, RecipientProgressService $progress): JsonResponse
    {
        return response()->json(['data' => $progress->forUser($request->user())]);
    }
}
