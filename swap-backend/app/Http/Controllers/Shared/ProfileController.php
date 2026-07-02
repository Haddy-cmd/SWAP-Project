<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Resources\UserResource;
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

        if (isset($validated['name'])) {
            $user->update(['name' => $validated['name']]);
        }

        $profileFields = array_diff_key($validated, ['name' => true]);
        if (!empty($profileFields)) {
            $user->profile()->updateOrCreate(['user_id' => $user->id], $profileFields);
        }

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

        return response()->json([
            'data' => new UserResource($user->fresh('profile')),
            'message' => 'Profile photo updated.',
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

        $request->user()->update(['password' => $request->password]);

        return response()->json(['message' => 'Password updated successfully.']);
    }
}
