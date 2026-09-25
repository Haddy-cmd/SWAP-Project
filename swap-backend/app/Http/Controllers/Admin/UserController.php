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

    // Staff accounts are created through emailed invitations (InvitationController),
    // never with an admin-chosen password.

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
                // Global per-role totals (ignore filters) to power the role tabs.
                'counts' => $this->userRepository->countByRole(),
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

        // Admin accounts can't be deactivated (they're protected, like delete) —
        // prevents locking out or disabling an administrator.
        if ($user->role === 'admin' && $request->has('is_active') && !$request->boolean('is_active')) {
            return response()->json(['message' => 'Admin accounts cannot be deactivated.'], 422);
        }

        $old = $user->only(['role', 'is_active']);
        $updated = $this->userRepository->update($user, $request->only(['role', 'is_active']));

        // Deactivation ends every open session now, not whenever the token expires.
        $new = $updated->only(['role', 'is_active']);
        if ($old['is_active'] && !$updated->is_active) {
            $new['tokens_revoked'] = $updated->tokens()->delete();
        }

        AuditLog::record('updated', $updated, $old, $new);

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

        // Admin accounts are never deletable — deactivate instead. Prevents both
        // lockouts and admins wiping each other out.
        if ($user->role === 'admin') {
            return response()->json(['message' => 'Admin accounts cannot be deleted. Deactivate the account instead.'], 422);
        }

        AuditLog::record('deleted', $user);
        $user->tokens()->delete();
        $this->userRepository->softDelete($user);

        return response()->json(['message' => 'User deleted.']);
    }
}
