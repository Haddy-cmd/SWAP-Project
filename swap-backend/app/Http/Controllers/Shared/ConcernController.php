<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Http\Requests\Concern\StoreConcernRequest;
use App\Resources\ConcernResource;
use App\Services\ConcernService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The Help page: send a concern to the DSA and read the replies. */
class ConcernController extends Controller
{
    public function __construct(private readonly ConcernService $concerns) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => ConcernResource::collection($this->concerns->mine($request->user()))]);
    }

    public function store(StoreConcernRequest $request): JsonResponse
    {
        $concern = $this->concerns->submit($request->user(), $request->validated());

        return response()->json([
            'data' => new ConcernResource($concern->unsetRelation('user')),
            'message' => 'Your concern has been submitted. The DSA Office will respond shortly.',
        ], 201);
    }
}
