<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\OneTimeCodeService;
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
            $request->only(['role', 'is_active', 'search', 'sort', 'unverified']),
            // Up to 100: the Offices drawer lists every supervisor in one call.
            min(100, max(1, (int) $request->query('per_page', 15)))
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
            $new['tokens_revoked'] = $this->signOutEverywhere($updated);
        }

        AuditLog::record('updated', $updated, $old, $new);

        return response()->json([
            'data' => new UserResource($updated),
            'message' => 'User updated.',
        ]);
    }

    /** Sessions and trusted browsers end now; returns how many sessions were ended. */
    private function signOutEverywhere(User $user): int
    {
        $revoked = $user->tokens()->delete();
        OneTimeCodeService::forgetDevices($user);

        return $revoked;
    }

    /**
     * Users → select several → Deactivate. Admins and the caller are skipped (as on the single
     * path, admin accounts can't be deactivated); each one is audited like a single deactivation.
     */
    public function bulkDeactivate(Request $request): JsonResponse
    {
        $data = $request->validate(['ids' => ['required', 'array', 'min:1', 'max:100'], 'ids.*' => ['integer']]);
        $ids = array_values(array_unique($data['ids']));

        $done = 0;
        foreach (User::whereIn('id', $ids)->get() as $user) {
            if ($user->role === 'admin' || $user->id === $request->user()->id || !$user->is_active) {
                continue;
            }
            $user->forceFill(['is_active' => false])->save();
            $revoked = $this->signOutEverywhere($user);
            AuditLog::record('updated', $user, ['is_active' => true], ['is_active' => false, 'tokens_revoked' => $revoked]);
            $done++;
        }

        return response()->json([
            'data' => ['deactivated' => $done, 'skipped' => count($ids) - $done],
            'message' => $done === 1 ? '1 account deactivated.' : "{$done} accounts deactivated.",
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
        \App\Services\OneTimeCodeService::forgetDevices($user);
        $this->userRepository->softDelete($user);

        return response()->json(['message' => 'User deleted.']);
    }
}
