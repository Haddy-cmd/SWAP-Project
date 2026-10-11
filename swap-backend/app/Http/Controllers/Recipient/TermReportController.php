<?php

namespace App\Http\Controllers\Recipient;

use App\Http\Controllers\Controller;
use App\Http\Requests\TermReport\SaveTermReportRequest;
use App\Services\TermReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** The recipient's end-of-term narrative report (Hours & Attendance page). */
class TermReportController extends Controller
{
    public function __construct(private readonly TermReportService $reports) {}

    public function show(Request $request): JsonResponse
    {
        ['assignment' => $assignment, 'report' => $report, 'editable' => $editable] = $this->reports->forUser($request->user());

        return response()->json([
            'data' => TermReportService::toArray($report),
            'meta' => [
                'has_assignment' => $assignment !== null,
                'editable' => $editable,
                'academic_year' => $assignment?->academic_year,
                'semester' => $assignment?->semester,
            ],
        ]);
    }

    public function update(SaveTermReportRequest $request): JsonResponse
    {
        $report = $this->reports->save($request->user(), $request->validated(), $request->file('file'));

        return response()->json([
            'data' => TermReportService::toArray($report),
            'message' => 'End-of-term report saved. You can edit it until your supervisor accepts it or your stipend is released.',
        ]);
    }

    /** Download the recipient's own uploaded report. */
    public function file(Request $request): StreamedResponse
    {
        $report = $this->reports->forUser($request->user())['report'];
        abort_unless((bool) $report?->file_path, 404, 'No report file.');

        return TermReportService::download($report);
    }
}
