<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAssignmentRequest;
use App\Resources\AssignmentResource;
use App\Services\AssignmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssignmentController extends Controller
{
    public function __construct(private readonly AssignmentService $assignmentService) {}

    public function index(Request $request): JsonResponse
    {
        $assignments = $this->assignmentService->paginateAssignments(
            $request->only(['office_id', 'supervisor_id', 'status', 'academic_year'])
        );

        return response()->json([
            'data' => AssignmentResource::collection($assignments->items()),
            'meta' => [
                'current_page' => $assignments->currentPage(),
                'last_page' => $assignments->lastPage(),
                'per_page' => $assignments->perPage(),
                'total' => $assignments->total(),
            ],
        ]);
    }

    public function store(StoreAssignmentRequest $request): JsonResponse
    {
        $assignment = $this->assignmentService->createAssignment(
            $request->validated(),
            $request->user()
        );

        return response()->json([
            'data' => new AssignmentResource($assignment),
            'message' => 'Assignment created and QR code generated.',
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $assignment = $this->assignmentService->getAssignmentById($id);

        if (!$assignment) {
            return response()->json(['message' => 'Assignment not found.'], 404);
        }

        $request->validate([
            'status' => ['sometimes', 'string', 'in:active,completed,suspended'],
            'required_hours' => ['sometimes', 'integer', 'min:1'],
            'end_date' => ['nullable', 'date'],
        ]);

        $updated = $this->assignmentService->updateAssignment(
            $assignment,
            $request->only(['status', 'required_hours', 'end_date']),
            $request->user()
        );

        return response()->json([
            'data' => new AssignmentResource($updated),
            'message' => 'Assignment updated.',
        ]);
    }

    public function regenerateQr(int $id): JsonResponse
    {
        $assignment = $this->assignmentService->getAssignmentById($id);

        if (!$assignment) {
            return response()->json(['message' => 'Assignment not found.'], 404);
        }

        $newToken = $this->assignmentService->regenerateQr($assignment);

        return response()->json([
            'data' => ['qr_code' => $newToken],
            'message' => 'QR code regenerated. All previous tokens are now invalid.',
        ]);
    }
}
