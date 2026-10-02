<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Http\Requests\Concern\ReplyConcernRequest;
use App\Http\Requests\Concern\StoreConcernRequest;
use App\Models\Concern;
use App\Resources\ConcernResource;
use App\Services\ConcernService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/** The SWAP Assistant's Ask the DSA tab: send a concern to the DSA and read the replies. */
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

    /** Add a follow-up to the caller's own concern (no subject — the thread keeps it). */
    public function reply(ReplyConcernRequest $request, int $id): JsonResponse
    {
        $concern = Concern::where('user_id', $request->user()->id)->find($id);
        if (!$concern) {
            throw new NotFoundHttpException('Concern not found.');
        }

        $concern = $this->concerns->addMessage($concern, $request->user(), $request->validated('body'));

        return response()->json([
            'data' => new ConcernResource($concern->unsetRelation('user')),
            'message' => 'Reply sent.',
        ], 201);
    }
}
