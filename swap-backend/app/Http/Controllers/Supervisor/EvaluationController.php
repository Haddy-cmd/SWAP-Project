<?php

namespace App\Http\Controllers\Supervisor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Supervisor\SaveTermEvaluationRequest;
use App\Models\Assignment;
use App\Services\TermEvaluationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The supervisor's end-of-term evaluation of a placement (1–5, 3+ passes). */
class EvaluationController extends Controller
{
    public function __construct(private readonly TermEvaluationService $evaluations) {}

    public function show(Request $request, int $id): JsonResponse
    {
        $evaluation = $this->evaluations->find(Assignment::findOrFail($id), $request->user());

        return response()->json(['data' => $evaluation?->toPayload()]);
    }

    public function update(SaveTermEvaluationRequest $request, int $id): JsonResponse
    {
        $evaluation = $this->evaluations->save(
            Assignment::findOrFail($id),
            $request->user(),
            (int) $request->validated('rating'),
            $request->validated('remarks'),
        );

        return response()->json([
            'data' => $evaluation->toPayload(),
            'message' => 'Evaluation saved.',
        ]);
    }
}
