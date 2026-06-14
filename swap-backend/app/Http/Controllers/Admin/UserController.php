<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Repositories\Contracts\UserRepositoryInterface;
use App\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(private readonly UserRepositoryInterface $userRepository) {}

    public function index(Request $request): JsonResponse
    {
        $users = $this->userRepository->paginate(
            $request->only(['role', 'is_active', 'search'])
        );

        return response()->json([
            'data' => UserResource::collection($users->items()),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = $this->userRepository->findById($id);

        if (!$user) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        $request->validate([
            'role' => ['sometimes', 'string', 'in:applicant,recipient,supervisor,admin'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $old = $user->only(['role', 'is_active']);
        $updated = $this->userRepository->update($user, $request->only(['role', 'is_active']));

        AuditLog::record('updated', $updated, $old, $updated->only(['role', 'is_active']));

        return response()->json([
            'data' => new UserResource($updated),
            'message' => 'User updated.',
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $this->userRepository->findById($id);

        if (!$user) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 422);
        }

        AuditLog::record('deleted', $user);
        $this->userRepository->softDelete($user);

        return response()->json(['message' => 'User deleted.']);
    }
}
