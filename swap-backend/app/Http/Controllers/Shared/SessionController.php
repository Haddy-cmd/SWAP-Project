<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Services\SessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The signed-in account's own logins (Profile → Security). */
class SessionController extends Controller
{
    public function __construct(private readonly SessionService $sessions) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->sessions->list($request->user())]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $this->sessions->revoke($request->user(), $id);

        return response()->json(['message' => 'Signed out of that device.']);
    }

    public function destroyOthers(Request $request): JsonResponse
    {
        $count = $this->sessions->revokeOthers($request->user());

        return response()->json([
            'data' => ['count' => $count],
            'message' => $count === 1 ? 'Signed out of 1 other device.' : "Signed out of {$count} other devices.",
        ]);
    }
}
