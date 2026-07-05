<?php

namespace App\Http\Controllers\Recipient;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Setting;
use App\Resources\ApplicationResource;
use App\Services\ApplicationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RenewalController extends Controller
{
    public function __construct(private readonly ApplicationService $applicationService) {}

    /** The recipient's submission for the current renewal term, if any. */
    public function index(Request $request): JsonResponse
    {
        $year = Setting::get('renewal_year');
        $semester = Setting::get('renewal_semester');

        $application = $year && $semester
            ? Application::where('user_id', $request->user()->id)
                ->where('academic_year', $year)
                ->where('semester', $semester)
                ->first()
            : null;

        return response()->json(['data' => $application ? new ApplicationResource($application) : null]);
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
