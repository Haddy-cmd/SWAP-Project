<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAssignmentRequest;
use App\Notifications\AdminHoursRequestNotification;
use App\Resources\AssignmentResource;
use App\Resources\TimeLogResource;
use App\Services\AssignmentService;
use App\Services\AttendanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssignmentController extends Controller
{
    public function __construct(
        private readonly AssignmentService $assignmentService,
        private readonly AttendanceService $attendanceService,
    ) {}

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

        // required_hours is intentionally excluded here — admin changes to it must be
        // approved by the supervisor via requestRequiredHours().
        $request->validate([
            'status' => ['sometimes', 'string', 'in:active,completed,suspended'],
            'end_date' => ['nullable', 'date'],
            'office_id' => ['sometimes', 'integer', 'exists:offices,id'],
            'supervisor_id' => ['sometimes', 'integer', 'exists:users,id'],
        ]);

        $updated = $this->assignmentService->updateAssignment(
            $assignment,
            $request->only(['status', 'end_date', 'office_id', 'supervisor_id']),
            $request->user()
        );

        return response()->json([
            'data' => new AssignmentResource($updated),
            'message' => 'Assignment updated.',
        ]);
    }

    /** Admin grants bonus hours — recorded as PENDING for the student's supervisor to approve. */
    public function addManualHours(Request $request, int $id): JsonResponse
    {
        $assignment = $this->assignmentService->getAssignmentById($id);

        if (!$assignment) {
            return response()->json(['message' => 'Assignment not found.'], 404);
        }

        $data = $request->validate([
            'hours' => ['required', 'numeric', 'min:0.25', 'max:24'],
            'date' => ['required', 'date', 'before_or_equal:today'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        // autoVerify: false → the supervisor must approve it (the student is under them).
        $log = $this->attendanceService->addManualHours(
            $assignment, (float) $data['hours'], $data['date'], $data['reason'], $request->user(), autoVerify: false
        );

        $assignment->loadMissing(['supervisor', 'user']);
        $assignment->supervisor?->notify(new AdminHoursRequestNotification([
            'title' => 'Bonus hours need your approval',
            'message' => "Admin granted {$data['hours']}h bonus to {$assignment->user->name}. Please review and verify.",
            'type' => 'verification',
            'log_id' => $log->id,
            'assignment_id' => $assignment->id,
            'student_id' => $assignment->user_id,
        ]));

        return response()->json([
            'data' => new TimeLogResource($log),
            'message' => 'Bonus hours submitted for supervisor approval.',
        ], 201);
    }

    /** Admin requests a required-hours change — stored as pending for the supervisor to approve. */
    public function requestRequiredHours(Request $request, int $id): JsonResponse
    {
        $assignment = $this->assignmentService->getAssignmentById($id);

        if (!$assignment) {
            return response()->json(['message' => 'Assignment not found.'], 404);
        }

        $data = $request->validate([
            'required_hours' => ['required', 'integer', 'min:1', 'max:2000'],
        ]);

        $assignment->update([
            'pending_required_hours' => $data['required_hours'],
            'pending_required_by' => $request->user()->id,
        ]);

        $assignment->loadMissing(['supervisor', 'user']);
        $assignment->supervisor?->notify(new AdminHoursRequestNotification([
            'title' => 'Required-hours change needs approval',
            'message' => "Admin requested changing {$assignment->user->name}'s required hours from {$assignment->required_hours}h to {$data['required_hours']}h.",
            'type' => 'approval',
            'assignment_id' => $assignment->id,
            'student_id' => $assignment->user_id,
        ]));

        return response()->json(['message' => 'Required-hours change submitted for supervisor approval.']);
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
