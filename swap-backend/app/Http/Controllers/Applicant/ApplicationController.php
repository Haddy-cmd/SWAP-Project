<?php

namespace App\Http\Controllers\Applicant;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreApplicationRequest;
use App\Models\Setting;
use App\Resources\ApplicationResource;
use App\Services\ApplicationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApplicationController extends Controller
{
    public function __construct(private readonly ApplicationService $applicationService) {}

    public function index(Request $request): JsonResponse
    {
        $applications = $this->applicationService->getUserApplications($request->user());

        return response()->json([
            'data' => ApplicationResource::collection($applications),
        ]);
    }

    public function store(StoreApplicationRequest $request): JsonResponse
    {
        // Block submissions while the application period is closed by the admin.
        if (!Setting::bool('applications_open', false)) {
            return response()->json([
                'message' => Setting::get('applications_closed_message', 'The application period has not started yet. Please check back later.'),
            ], 403);
        }

        $application = $this->applicationService->submitApplication(
            $request->user(),
            $request->validated()
        );

        return response()->json([
            'data' => new ApplicationResource($application),
            'message' => 'Application submitted successfully.',
        ], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $application = $this->applicationService->getApplicationById($id);

        if (!$application || $application->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Application not found.'], 404);
        }

        return response()->json(['data' => new ApplicationResource($application)]);
    }

    public function status(Request $request, int $id): JsonResponse
    {
        $application = $this->applicationService->getApplicationById($id);

        if (!$application || $application->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Application not found.'], 404);
        }

        return response()->json([
            'data' => [
                'id' => $application->id,
                'status' => $application->status,
                'remarks' => $application->remarks,
                'reviewed_at' => $application->reviewed_at?->toISOString(),
                'interview' => $application->interview ? [
                    'scheduled_at' => $application->interview->scheduled_at->toISOString(),
                    'location' => $application->interview->location,
                    'mode' => $application->interview->mode,
                ] : null,
            ],
        ]);
    }
}
