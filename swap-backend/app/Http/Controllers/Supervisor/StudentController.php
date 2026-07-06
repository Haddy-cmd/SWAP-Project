<?php

namespace App\Http\Controllers\Supervisor;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\User;
use App\Repositories\Contracts\TimeLogRepositoryInterface;
use App\Resources\AssignmentResource;
use App\Resources\TimeLogResource;
use App\Services\AttendanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    public function __construct(
        private readonly TimeLogRepositoryInterface $timeLogRepository,
        private readonly AttendanceService $attendanceService,
    ) {}

    /**
     * Resolve the student's active assignment managed by this supervisor, or null.
     * Co-supervisors of the same office share students (visibleToSupervisor).
     */
    private function ownedAssignment(User $supervisor, int $studentId): ?Assignment
    {
        return Assignment::where('user_id', $studentId)
            ->visibleToSupervisor($supervisor)
            ->where('status', 'active')
            ->first();
    }

    public function index(Request $request): JsonResponse
    {
        $assignments = Assignment::with(['user.profile', 'office'])
            ->withCount(['timeLogs as pending_logs_count' => fn ($q) => $q->where('status', 'pending_verification')])
            ->visibleToSupervisor($request->user())
            ->where('status', 'active')
            ->get();

        return response()->json([
            'data' => AssignmentResource::collection($assignments),
            'meta' => [
                'pending_verifications' => $this->timeLogRepository->getPendingVerificationsCount($request->user()->id),
                'verified_this_week' => $this->timeLogRepository->getVerifiedThisWeekCount($request->user()->id),
            ],
        ]);
    }

    public function clockedIn(Request $request): JsonResponse
    {
        // Ignore logs open longer than a full session: those are forgotten
        // clock-outs awaiting the stale-close cron, not live sessions — showing
        // them here produces a bogus multi-day "currently clocked in" timer.
        $freshCutoff = now()->subHours(AttendanceService::MAX_SESSION_HOURS);

        $logs = \App\Models\TimeLog::with(['user.profile', 'assignment.office'])
            ->where('status', 'open')
            ->where('time_in', '>=', $freshCutoff)
            ->whereHas('assignment', fn ($q) => $q->visibleToSupervisor($request->user()))
            ->orderBy('time_in')
            ->get();

        return response()->json([
            'data' => TimeLogResource::collection($logs),
        ]);
    }

    public function summary(Request $request, int $studentId): JsonResponse
    {
        $assignment = Assignment::with(['user.profile', 'office'])
            ->where('user_id', $studentId)
            ->visibleToSupervisor($request->user())
            ->where('status', 'active')
            ->first();

        if (!$assignment) {
            return response()->json(['message' => 'Student not found or not assigned to you.'], 404);
        }

        return response()->json([
            'data' => $this->timeLogRepository->getHoursSummary($studentId),
            'student' => [
                'id' => $assignment->user->id,
                'name' => $assignment->user->profile?->full_name ?? $assignment->user->name,
                'email' => $assignment->user->email,
                'office' => $assignment->office?->name,
                'academic_year' => $assignment->academic_year,
                'semester' => $assignment->semester,
                'required_hours' => $assignment->required_hours,
            ],
        ]);
    }

    public function logs(Request $request, int $studentId): JsonResponse
    {
        $assignment = Assignment::with('user.profile')
            ->where('user_id', $studentId)
            ->visibleToSupervisor($request->user())
            ->where('status', 'active')
            ->first();

        if (!$assignment) {
            return response()->json(['message' => 'Student not found or not assigned to you.'], 404);
        }

        $perPage = min(200, max(1, (int) $request->input('per_page', 15)));

        $logs = $this->timeLogRepository->paginateForSupervisor(
            $request->user()->id,
            array_merge($request->only(['status', 'from', 'to']), ['user_id' => $studentId]),
            $perPage
        );

        return response()->json([
            'data' => TimeLogResource::collection($logs->items()),
            'student' => [
                'id' => $assignment->user->id,
                'name' => $assignment->user->profile?->full_name ?? $assignment->user->name,
                'required_hours' => $assignment->required_hours,
                'pending_required_hours' => $assignment->pending_required_hours,
            ],
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    /**
     * The application documents (COR, grades, letter of intent, ID photo) of a
     * recipient this supervisor manages — so supervisors can review their own
     * students' requirements without asking the admin.
     */
    public function documents(Request $request, int $studentId): JsonResponse
    {
        $assignment = $this->ownedAssignment($request->user(), $studentId);
        if (!$assignment) {
            return response()->json(['message' => 'Student not found or not assigned to you.'], 404);
        }

        $token = $request->bearerToken();

        // Include each document's application term so renewals don't get mixed in
        // with earlier submissions. Newest term first, then by document type.
        $documents = \App\Models\ApplicationDocument::with('application:id,academic_year,semester,type,created_at')
            ->whereHas('application', fn ($q) => $q->where('user_id', $studentId))
            ->get()
            ->sortBy('document_type')
            ->sortByDesc(fn ($doc) => optional($doc->application)->created_at?->timestamp ?? 0)
            ->values()
            ->map(function ($doc) use ($token) {
                $url = rtrim(config('app.url'), '/') . '/api/documents/' . $doc->id . '/file';
                if ($token) {
                    $url .= '?token=' . urlencode($token);
                }
                return [
                    'id' => $doc->id,
                    'document_type' => $doc->document_type,
                    'file_url' => $url,
                    'file_name' => $doc->file_name,
                    'mime_type' => $doc->mime_type,
                    'application_id' => $doc->application_id,
                    'academic_year' => $doc->application?->academic_year,
                    'semester' => $doc->application?->semester,
                    'type' => $doc->application?->type ?? 'new',
                ];
            });

        return response()->json(['data' => $documents]);
    }

    /** Grant manual/bonus hours to a student in this supervisor's office. */
    public function addManualHours(Request $request, int $studentId): JsonResponse
    {
        $assignment = $this->ownedAssignment($request->user(), $studentId);
        if (!$assignment) {
            return response()->json(['message' => 'Student not found or not assigned to you.'], 404);
        }

        $data = $request->validate([
            'hours' => ['required', 'numeric', 'min:0.25', 'max:24'],
            'date' => ['required', 'date', 'before_or_equal:today'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $log = $this->attendanceService->addManualHours(
            $assignment, (float) $data['hours'], $data['date'], $data['reason'], $request->user()
        );

        return response()->json([
            'data' => new TimeLogResource($log),
            'message' => 'Bonus hours added.',
        ], 201);
    }

    /** Adjust the hours the student is required to render this semester. */
    public function updateRequiredHours(Request $request, int $studentId): JsonResponse
    {
        $assignment = $this->ownedAssignment($request->user(), $studentId);
        if (!$assignment) {
            return response()->json(['message' => 'Student not found or not assigned to you.'], 404);
        }

        $data = $request->validate([
            'required_hours' => ['required', 'integer', 'min:1', 'max:2000'],
        ]);

        $assignment->update(['required_hours' => $data['required_hours']]);

        return response()->json(['message' => 'Required hours updated.', 'data' => ['required_hours' => $assignment->required_hours]]);
    }

    /** Approve or reject an admin-requested required-hours change. */
    public function decideRequiredHours(Request $request, int $studentId): JsonResponse
    {
        $assignment = $this->ownedAssignment($request->user(), $studentId);
        if (!$assignment) {
            return response()->json(['message' => 'Student not found or not assigned to you.'], 404);
        }

        $data = $request->validate(['action' => ['required', 'in:approve,reject']]);

        if ($assignment->pending_required_hours === null) {
            return response()->json(['message' => 'There is no pending required-hours change.'], 422);
        }

        if ($data['action'] === 'approve') {
            $assignment->update([
                'required_hours' => $assignment->pending_required_hours,
                'pending_required_hours' => null,
                'pending_required_by' => null,
            ]);
            $message = 'Required-hours change approved.';
        } else {
            $assignment->update(['pending_required_hours' => null, 'pending_required_by' => null]);
            $message = 'Required-hours change rejected.';
        }

        return response()->json(['message' => $message, 'data' => ['required_hours' => $assignment->required_hours]]);
    }
}
