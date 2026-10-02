<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Concern\UpdateConcernRequest;
use App\Models\Concern;
use App\Resources\ConcernResource;
use App\Services\ConcernService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Admin → Concerns inbox: read, triage and answer what users send from the SWAP Assistant (Ask the DSA). */
class ConcernController extends Controller
{
    public function __construct(private readonly ConcernService $concerns) {}

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate(['status' => ['nullable', Rule::in(Concern::STATUSES)]]);
        $page = $this->concerns->inbox($validated['status'] ?? null);

        return response()->json([
            'data' => ConcernResource::collection($page->items()),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'counts' => $this->concerns->counts(),
            ],
        ]);
    }

    public function update(UpdateConcernRequest $request, int $id): JsonResponse
    {
        $concern = $this->concerns->update(Concern::findOrFail($id), $request->validated(), $request->user());

        return response()->json([
            'data' => new ConcernResource($concern),
            'message' => $concern->status === Concern::STATUS_RESOLVED
                ? 'Concern resolved. The student has been notified.'
                : 'Concern updated.',
        ]);
    }
}
