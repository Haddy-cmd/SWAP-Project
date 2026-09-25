<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Models\AuditLog;
use App\Resources\UserResource;
use App\Support\StipendUnlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'data' => new UserResource($request->user()->load('profile')),
        ]);
    }

    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validated();
        $before = $user->only(['name', 'position_title']) + ($user->profile?->only(array_keys($validated)) ?? []);

        if (isset($validated['name'])) {
            $user->update(['name' => $validated['name']]);
        }

        if (array_key_exists('position_title', $validated)) {
            $user->update(['position_title' => $validated['position_title']]);
        }

        $profileFields = array_diff_key($validated, ['name' => true, 'position_title' => true]);
        if (!empty($profileFields)) {
            $user->profile()->updateOrCreate(['user_id' => $user->id], $profileFields);
        }

        AuditLog::record('profile_updated', $user, array_intersect_key($before, $validated), $validated);

        return response()->json([
            'data' => new UserResource($user->fresh('profile')),
            'message' => 'Profile updated.',
        ]);
    }

    public function updatePhoto(Request $request): JsonResponse
    {
        $request->validate([
            'photo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        $user = $request->user();
        $disk = config('filesystems.documents_disk', 'public');

        try {
            $path = $request->file('photo')->store("avatars/{$user->id}", $disk);
            if ($path === false) {
                throw new \Exception('Storage driver returned false (check credentials/permissions).');
            }
        } catch (\Throwable $e) {
            $root = $e;
            while ($root->getPrevious()) {
                $root = $root->getPrevious();
            }
            Log::error('Avatar upload failed', ['disk' => $disk, 'error' => $e->getMessage(), 'cause' => $root->getMessage()]);
            return response()->json(['message' => 'Failed to upload photo to storage.', 'error' => $root->getMessage()], 500);
        }

        // Remove the previous avatar so the bucket doesn't accumulate orphans.
        $old = $user->avatar_path;
        $user->update(['avatar_path' => $path]);
        if ($old && $old !== $path) {
            try { Storage::disk($disk)->delete($old); } catch (\Throwable) { /* best effort */ }
        }
        AuditLog::record('photo_updated', $user, ['avatar_path' => $old], ['avatar_path' => $path]);

        return response()->json([
            'data' => new UserResource($user->fresh('profile')),
            'message' => 'Profile photo updated.',
        ]);
    }

    public function deletePhoto(Request $request): JsonResponse
    {
        $user = $request->user();
        $old = $user->avatar_path;
        $user->update(['avatar_path' => null]);
        AuditLog::record('photo_removed', $user, ['avatar_path' => $old], ['avatar_path' => null]);

        // The avatar is always its own object under avatars/{id}, never the ID
        // document, so removing it never affects the application requirement.
        if ($old) {
            try {
                Storage::disk(config('filesystems.documents_disk', 'public'))->delete($old);
            } catch (\Throwable) {
                // best effort
            }
        }

        return response()->json([
            'data' => new UserResource($user->fresh('profile')),
            'message' => 'Profile photo removed.',
        ]);
    }

    /**
     * Save the user's digital-signature specimen (drawn on screen or uploaded).
     * It is auto-applied to the stipend signatures this user makes — director
     * certification for admins, mentor co-sign for supervisors. Same storage
     * discipline as the avatar: one object per user, old file removed.
     */
    public function updateSignature(Request $request): JsonResponse
    {
        $request->validate([
            'signature' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $user = $request->user();
        $disk = config('filesystems.documents_disk', 'public');

        try {
            $path = $request->file('signature')->store("signatures/{$user->id}", $disk);
            if ($path === false) {
                throw new \Exception('Storage driver returned false (check credentials/permissions).');
            }
        } catch (\Throwable $e) {
            $root = $e;
            while ($root->getPrevious()) {
                $root = $root->getPrevious();
            }
            Log::error('Signature upload failed', ['disk' => $disk, 'error' => $e->getMessage(), 'cause' => $root->getMessage()]);
            return response()->json(['message' => 'Failed to upload signature to storage.', 'error' => $root->getMessage()], 500);
        }

        $old = $user->signature_image_path;
        $user->update(['signature_image_path' => $path]);
        if ($old && $old !== $path) {
            // Safe: signed stubs keep their own copy (StipendClaimService::snapshotSpecimen).
            try { Storage::disk($disk)->delete($old); } catch (\Throwable) { /* best effort */ }
        }
        AuditLog::record('signature_updated', $user, ['signature_image_path' => $old], ['signature_image_path' => $path]);

        return response()->json([
            'data' => new UserResource($user->fresh('profile')),
            'message' => 'Digital signature saved. It will appear on newly released claim stubs.',
        ]);
    }

    public function deleteSignature(Request $request): JsonResponse
    {
        $user = $request->user();
        $old = $user->signature_image_path;
        $user->update(['signature_image_path' => null]);
        AuditLog::record('signature_removed', $user, ['signature_image_path' => $old], ['signature_image_path' => null]);

        if ($old) {
            try {
                Storage::disk(config('filesystems.documents_disk', 'public'))->delete($old);
            } catch (\Throwable) {
                // best effort
            }
        }

        return response()->json([
            'data' => new UserResource($user->fresh('profile')),
            'message' => 'Digital signature removed. New stubs will show your printed name instead.',
        ]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()],
        ]);

        if (!Hash::check($request->current_password, $request->user()->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user = $request->user();
        $user->update(['password' => $request->password]);

        // A new password ends every other session (a stolen token stops working)
        // and closes any open stipend step-up window.
        $current = $user->currentAccessToken();
        $user->tokens()
            ->when($current && isset($current->id), fn ($q) => $q->where('id', '!=', $current->id))
            ->delete();
        StipendUnlock::revoke($user);

        // Never the password itself — only that it changed.
        AuditLog::record('password_changed', $user);

        return response()->json(['message' => 'Password updated successfully.']);
    }
}
