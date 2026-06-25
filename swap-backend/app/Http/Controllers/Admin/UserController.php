<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Repositories\Contracts\UserRepositoryInterface;
use App\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(private readonly UserRepositoryInterface $userRepository) {}

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            // Admins may only create staff accounts — supervisors and other admins.
            // Applicants/recipients enter the system through student self-registration.
            'role' => ['required', 'string', 'in:supervisor,admin'],
            'office_id' => ['nullable', 'integer', 'exists:offices,id'],
        ]);

        // office_id only applies to supervisors; ignore it for other roles.
        $officeId = $validated['role'] === 'supervisor' ? ($validated['office_id'] ?? null) : null;

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'], // auto-hashed by the User model cast
            'role' => $validated['role'],
            'office_id' => $officeId,
            'is_active' => true,
            'email_verified_at' => now(),
        ]);

        AuditLog::record('created', $user);

        return response()->json([
            'data' => new UserResource($user),
            'message' => 'User created.',
        ], 201);
    }

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
