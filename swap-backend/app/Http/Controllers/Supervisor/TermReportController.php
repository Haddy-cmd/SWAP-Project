<?php

namespace App\Http\Controllers\Supervisor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Supervisor\ReviewTermReportRequest;
use App\Models\Assignment;
use App\Services\TermReportReviewService;
use App\Services\TermReportService;
use Illuminate\Http\JsonResponse;

/** The supervisor accepts a student's end-of-term report, marking them eligible or not for renewal. */
class TermReportController extends Controller
{
    public function __construct(private readonly TermReportReviewService $reviews) {}

    public function review(ReviewTermReportRequest $request, int $id): JsonResponse
    {
        $eligible = (bool) $request->validated('renewal_eligible');
        $report = $this->reviews->review($request->user(), Assignment::findOrFail($id), $eligible, $request->validated('remarks'));

        return response()->json([
            'data' => TermReportService::toArray($report),
            'message' => $eligible
                ? 'Report accepted. The student is marked eligible for renewal.'
                : 'Report accepted. The student is marked not eligible for renewal.',
        ]);
    }
}
