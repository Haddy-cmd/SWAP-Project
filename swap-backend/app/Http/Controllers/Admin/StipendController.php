<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Resources\StipendResource;
use App\Services\StipendService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StipendController extends Controller
{
    public function __construct(private readonly StipendService $stipendService) {}

    public function index(Request $request): JsonResponse
    {
        $records = $this->stipendService->paginateAll(
            $request->only(['status', 'academic_year'])
        );

        return response()->json([
            'data' => StipendResource::collection($records->items()),
            'meta' => [
                'current_page' => $records->currentPage(),
                'last_page' => $records->lastPage(),
                'per_page' => $records->perPage(),
                'total' => $records->total(),
            ],
        ]);
    }

    public function eligible(): JsonResponse
    {
        return response()->json([
            'data' => $this->stipendService->eligibleRecipients(),
        ]);
    }

    public function release(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'academic_year' => ['required', 'string'],
            'semester' => ['required', 'string'],
            'period_label' => ['nullable', 'string', 'max:100'],
            'remarks' => ['nullable', 'string', 'max:500'],
        ]);

        $stipend = $this->stipendService->release($validated, $request->user());

        return response()->json([
            'data' => new StipendResource($stipend),
            'message' => 'Stipend released. Recipient has been notified.',
        ], 201);
    }
}
