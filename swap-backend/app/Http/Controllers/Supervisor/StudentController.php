<?php

namespace App\Http\Controllers\Supervisor;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Repositories\Contracts\TimeLogRepositoryInterface;
use App\Resources\AssignmentResource;
use App\Resources\TimeLogResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    public function __construct(private readonly TimeLogRepositoryInterface $timeLogRepository) {}

    public function index(Request $request): JsonResponse
    {
        $assignments = Assignment::with(['user.profile', 'office'])
            ->where('supervisor_id', $request->user()->id)
            ->where('status', 'active')
            ->get();

        $pendingCount = $this->timeLogRepository->getPendingVerificationsCount($request->user()->id);

        return response()->json([
            'data' => AssignmentResource::collection($assignments),
            'meta' => ['pending_verifications' => $pendingCount],
        ]);
    }

    public function logs(Request $request, int $studentId): JsonResponse
    {
        $assignment = Assignment::where('user_id', $studentId)
            ->where('supervisor_id', $request->user()->id)
            ->where('status', 'active')
            ->first();

        if (!$assignment) {
            return response()->json(['message' => 'Student not found or not assigned to you.'], 404);
        }

        $logs = $this->timeLogRepository->paginateForSupervisor(
            $request->user()->id,
            array_merge($request->only(['status', 'from', 'to']), ['user_id' => $studentId])
        );

        return response()->json([
            'data' => TimeLogResource::collection($logs->items()),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }
}
