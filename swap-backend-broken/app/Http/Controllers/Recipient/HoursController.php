<?php

namespace App\Http\Controllers\Recipient;

use App\Http\Controllers\Controller;
use App\Services\AttendanceService;
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
}
