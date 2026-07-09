<?php

namespace App\Http\Controllers\Recipient;

use App\Http\Controllers\Controller;
use App\Resources\AssignmentResource;
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

    public function assignment(Request $request): JsonResponse
    {
        $assignment = $this->attendanceService->getActiveAssignment($request->user());

        return response()->json([
            'data' => $assignment ? new AssignmentResource($assignment) : null,
        ]);
    }

    public function logs(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:open,pending_verification,verified,rejected'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $logs = $this->attendanceService->getLogsForUser(
            $request->user(),
            ['status' => $validated['status'] ?? null],
            $validated['per_page'] ?? 15,
        );

        return response()->json([
            'data' => TimeLogResource::collection($logs),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    public function timeInGeofence(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'qr_token' => ['required', 'string'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0'],
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        $log = $this->attendanceService->timeInGeofence(
            $request->user(),
            $validated['qr_token'],
            isset($validated['latitude']) ? (float) $validated['latitude'] : null,
            isset($validated['longitude']) ? (float) $validated['longitude'] : null,
            isset($validated['accuracy']) ? (float) $validated['accuracy'] : null,
            $request->file('photo'),
        );

        return response()->json([
            'data' => new TimeLogResource($log),
            'message' => 'Time-in recorded successfully.',
        ], 201);
    }

    public function timeOut(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'log_id' => ['required', 'integer'],
            'qr_token' => ['required', 'string'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0'],
        ]);

        $log = $this->attendanceService->timeOut(
            $request->user(),
            $validated['log_id'],
            $validated['qr_token'],
            isset($validated['latitude']) ? (float) $validated['latitude'] : null,
            isset($validated['longitude']) ? (float) $validated['longitude'] : null,
            isset($validated['accuracy']) ? (float) $validated['accuracy'] : null,
        );

        return response()->json([
            'data' => new TimeLogResource($log),
            'message' => 'Time-out recorded. Log is now pending verification.',
        ]);
    }

    public function autoClockOut(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'log_id' => ['required', 'integer'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0'],
        ]);

        $log = $this->attendanceService->autoClockOut(
            $request->user(),
            $validated['log_id'],
            isset($validated['latitude']) ? (float) $validated['latitude'] : null,
            isset($validated['longitude']) ? (float) $validated['longitude'] : null,
            isset($validated['accuracy']) ? (float) $validated['accuracy'] : null,
        );

        return response()->json([
            'data' => new TimeLogResource($log),
            'message' => 'You left the office premises and were automatically clocked out.',
        ]);
    }
}
