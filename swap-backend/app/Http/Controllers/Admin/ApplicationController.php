<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\DecideApplicationRequest;
use App\Http\Requests\ReopenApplicationRequest;
use App\Http\Requests\StoreInterviewRequest;
use App\Resources\ApplicationResource;
use App\Services\ApplicationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApplicationController extends Controller
{
    public function __construct(private readonly ApplicationService $applicationService) {}

    public function index(Request $request): JsonResponse
    {
        // interview_from/to (Manila days) + per_page: the Interview set calendar loads a month at once.
        $request->validate([
            'interview_from' => ['nullable', 'date_format:Y-m-d'],
            'interview_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:interview_from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);
        $applications = $this->applicationService->paginateForAdmin($request->only([
            'status', 'exclude_status', 'academic_year', 'semester', 'search', 'type', 'unassigned', 'interview_from', 'interview_to',
        ]), (int) $request->query('per_page', 15));

        return response()->json([
            'data' => ApplicationResource::collection($applications->items()),
            'meta' => [
                'current_page' => $applications->currentPage(),
                'last_page' => $applications->lastPage(),
                'per_page' => $applications->perPage(),
                'total' => $applications->total(),
            ],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $application = $this->applicationService->getApplicationById($id);

        if (!$application) {
            return response()->json(['message' => 'Application not found.'], 404);
        }

        return response()->json(['data' => new ApplicationResource($application)]);
    }

    public function review(Request $request, int $id): JsonResponse
    {
        $application = $this->applicationService->getApplicationById($id);

        if (!$application) {
            return response()->json(['message' => 'Application not found.'], 404);
        }

        $updated = $this->applicationService->markUnderReview($application, $request->user());

        return response()->json([
            'data' => new ApplicationResource($updated),
            'message' => 'Application marked as under review.',
        ]);
    }

    public function interview(StoreInterviewRequest $request, int $id): JsonResponse
    {
        $application = $this->applicationService->getApplicationById($id);

        if (!$application) {
            return response()->json(['message' => 'Application not found.'], 404);
        }

        $updated = $this->applicationService->scheduleInterview(
            $application,
            $request->validated(),
            $request->user()
        );

        return response()->json([
            'data' => new ApplicationResource($updated),
            'message' => 'Interview scheduled. Applicant has been notified.',
        ]);
    }

    /** Move an existing interview to a new time; the change is audit-logged. */
    public function rescheduleInterview(StoreInterviewRequest $request, int $id): JsonResponse
    {
        $application = $this->applicationService->getApplicationById($id);

        if (!$application) {
            return response()->json(['message' => 'Application not found.'], 404);
        }

        $updated = $this->applicationService->rescheduleInterview(
            $application,
            $request->validated(),
            $request->user()
        );

        return response()->json([
            'data' => new ApplicationResource($updated),
            'message' => 'Interview rescheduled. Applicant has been notified.',
        ]);
    }

    /** Record that the applicant did not attend their interview. */
    public function markInterviewNoShow(Request $request, int $id): JsonResponse
    {
        $application = $this->applicationService->getApplicationById($id);

        if (!$application) {
            return response()->json(['message' => 'Application not found.'], 404);
        }

        $updated = $this->applicationService->markInterviewNoShow($application, $request->user());

        return response()->json([
            'data' => new ApplicationResource($updated),
            'message' => 'Interview marked as no-show.',
        ]);
    }

    public function decide(DecideApplicationRequest $request, int $id): JsonResponse
    {
        $application = $this->applicationService->getApplicationById($id);

        if (!$application) {
            return response()->json(['message' => 'Application not found.'], 404);
        }

        $updated = $this->applicationService->decideApplication(
            $application,
            $request->decision,
            $request->remarks,
            $request->user(),
            $request->decision === 'rejected' ? $request->rejection_reason : null,
        );

        return response()->json([
            'data' => new ApplicationResource($updated),
            'message' => "Application {$request->decision}. Applicant has been notified.",
        ]);
    }

    /** Undo a rejection made by mistake (current semester, new applications only). */
    public function reopen(ReopenApplicationRequest $request, int $id): JsonResponse
    {
        $application = $this->applicationService->getApplicationById($id);

        if (!$application) {
            return response()->json(['message' => 'Application not found.'], 404);
        }

        $updated = $this->applicationService->reopenApplication($application, $request->validated('reason'), $request->user());

        return response()->json([
            'data' => new ApplicationResource($updated),
            'message' => 'Application reopened. Applicant has been notified.',
        ]);
    }
}
