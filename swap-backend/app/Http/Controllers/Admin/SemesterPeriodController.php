<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Semester\SaveSemesterPeriodRequest;
use App\Models\SemesterPeriod;
use App\Resources\SemesterPeriodResource;
use App\Services\SemesterPeriodService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin → Semesters: the DSA calendar every term-date rule reads from. */
class SemesterPeriodController extends Controller
{
    public function __construct(private readonly SemesterPeriodService $periods) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => SemesterPeriodResource::collection($this->periods->all())]);
    }

    /** For the admin dashboard card: the current term, else the next one. */
    public function current(): JsonResponse
    {
        $current = $this->periods->current();
        $next = $current ? null : $this->periods->next();

        return response()->json(['data' => [
            'current' => $current ? new SemesterPeriodResource($current) : null,
            'next' => $next ? new SemesterPeriodResource($next) : null,
            'renewal' => ($r = SemesterPeriodService::renewalTarget()) ? new SemesterPeriodResource($r) : null,
        ]]);
    }

    public function store(SaveSemesterPeriodRequest $request): JsonResponse
    {
        $period = $this->periods->create($request->validated(), $request->user());

        return response()->json([
            'data' => new SemesterPeriodResource($period),
            'message' => "{$period->label()} saved.",
        ], 201);
    }

    public function update(SaveSemesterPeriodRequest $request, int $id): JsonResponse
    {
        $period = $this->periods->update(SemesterPeriod::findOrFail($id), $request->validated(), $request->user());

        return response()->json([
            'data' => new SemesterPeriodResource($period),
            'message' => "{$period->label()} updated.",
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $period = SemesterPeriod::findOrFail($id);
        $this->periods->delete($period, $request->user());

        return response()->json(['message' => "{$period->label()} deleted."]);
    }
}
