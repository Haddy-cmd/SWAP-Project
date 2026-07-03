<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\StaffInvitation;
use App\Models\User;
use App\Notifications\StaffInvitationNotification;
use App\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class InvitationController extends Controller
{
    /** Admin: email an account-creation link instead of creating the account directly. */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'name' => ['nullable', 'string', 'max:150'],
            'role' => ['required', 'string', 'in:supervisor,admin'],
            'office_id' => ['nullable', 'integer', 'exists:offices,id'],
        ]);

        // Re-inviting the same address replaces any older pending invitation.
        StaffInvitation::where('email', $validated['email'])->whereNull('accepted_at')->delete();

        $plainToken = Str::random(64);

        $invitation = StaffInvitation::create([
            'email' => $validated['email'],
            'name' => $validated['name'] ?? null,
            'role' => $validated['role'],
            'office_id' => $validated['role'] === 'supervisor' ? ($validated['office_id'] ?? null) : null,
            'token' => hash('sha256', $plainToken),
            'invited_by' => $request->user()->id,
            'expires_at' => now()->addDays(StaffInvitation::EXPIRES_DAYS),
        ]);

        Notification::route('mail', $invitation->email)
            ->notify(new StaffInvitationNotification($invitation->load(['office', 'inviter']), $plainToken));

        AuditLog::record('created', $invitation);

        return response()->json([
            'message' => "Invitation sent to {$invitation->email}.",
        ], 201);
    }

    /** Public: describe an invitation so the accept page can show context. */
    public function show(string $token): JsonResponse
    {
        $invitation = StaffInvitation::findByPlainToken($token);

        if (!$invitation || !$invitation->isUsable()) {
            return response()->json(['message' => 'This invitation link is invalid or has expired.'], 404);
        }

        return response()->json(['data' => [
            'email' => $invitation->email,
            'name' => $invitation->name,
            'role' => $invitation->role,
            'office' => $invitation->office?->name,
            'expires_at' => $invitation->expires_at->toISOString(),
        ]]);
    }

    /** Public: accept the invitation — the invitee sets their own password. */
    public function accept(Request $request, string $token): JsonResponse
    {
        $invitation = StaffInvitation::findByPlainToken($token);

        if (!$invitation || !$invitation->isUsable()) {
            return response()->json(['message' => 'This invitation link is invalid or has expired.'], 404);
        }

        if (User::where('email', $invitation->email)->exists()) {
            return response()->json(['message' => 'An account with this email already exists. Please sign in instead.'], 422);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'password' => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $invitation->email,
            'password' => $validated['password'], // hashed by the model cast
            'role' => $invitation->role,
            'office_id' => $invitation->office_id,
            'is_active' => true,
            'email_verified_at' => now(), // proved ownership by opening the emailed link
        ]);

        $invitation->update(['accepted_at' => now()]);
        AuditLog::record('created', $user);

        // Sign them straight in, mirroring the login response shape.
        $authToken = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'data' => new UserResource($user),
            'token' => $authToken,
            'message' => 'Account created. Welcome to the SWAP Portal!',
        ], 201);
    }
}
