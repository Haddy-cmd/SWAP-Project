<?php

namespace App\Http\Controllers\Recipient;

use App\Http\Controllers\Controller;
use App\Resources\TimeLogResource;
use App\Services\AttendanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function __construct(private readonly AttendanceService $attendanceService) {}

    public function current(Request $request): JsonResponse
    {
        $log = $this->attendanceService->getOpenLog($request->user());

        return response()->json([
            'data' => $log ? new TimeLogResource($log) : null,
        ]);
    }

    public function timeIn(Request $request): JsonResponse
    {
        $request->validate([
            'qr_token' => ['required', 'string'],
        ]);

        $log = $this->attendanceService->timeIn($request->user(), $request->qr_token);

        return response()->json([
            'data' => new TimeLogResource($log),
            'message' => 'Time-in recorded successfully.',
        ], 201);
    }

    public function timeOut(Request $request): JsonResponse
    {
        $request->validate([
            'log_id' => ['required', 'integer'],
            'qr_token' => ['required', 'string'],
        ]);

        $log = $this->attendanceService->timeOut(
            $request->user(),
            $request->log_id,
            $request->qr_token
        );

        return response()->json([
            'data' => new TimeLogResource($log),
            'message' => 'Time-out recorded. Log is now pending verification.',
        ]);
    }
}
