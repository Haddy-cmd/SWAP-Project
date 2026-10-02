<?php

namespace App\Http\Controllers\Recipient;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Assignment;
use App\Resources\ApplicationResource;
use App\Services\ApplicationService;
use App\Services\SemesterPeriodService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RenewalController extends Controller
{
    public function __construct(private readonly ApplicationService $applicationService) {}

    /** The recipient's submission for the current renewal term, if any. */
    public function index(Request $request): JsonResponse
    {
        $target = SemesterPeriodService::renewalTarget();

        $application = $target
            ? Application::where('user_id', $request->user()->id)
                ->where('academic_year', $target->academic_year)
                ->where('semester', $target->semester)
                ->first()
            : null;

        // An approved renewal rolls the student into the new term; say "approved"
        // only when that placement really exists.
        $placed = $target && Assignment::where('user_id', $request->user()->id)
            ->where('academic_year', $target->academic_year)
            ->where('semester', $target->semester)
            ->where('status', 'active')
            ->exists();

        return response()->json([
            'data' => $application ? new ApplicationResource($application) : null,
            'meta' => ['placed' => $placed],
        ]);
    }

    /** Submit a semester renewal: one updated COR, no interview round. */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'cor' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
        ]);

        $application = $this->applicationService->submitRenewal($request->user(), $request->file('cor'));

        return response()->json([
            'data' => new ApplicationResource($application),
            'message' => 'Renewal submitted. The DSA office will review your updated COR.',
        ], 201);
    }
}
