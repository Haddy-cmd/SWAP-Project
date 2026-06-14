<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\DecideApplicationRequest;
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
        $applications = $this->applicationService->paginateForAdmin($request->only([
            'status', 'academic_year', 'semester', 'search',
        ]));

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
            $request->user()
        );

        return response()->json([
            'data' => new ApplicationResource($updated),
            'message' => "Application {$request->decision}. Applicant has been notified.",
        ]);
    }
}
