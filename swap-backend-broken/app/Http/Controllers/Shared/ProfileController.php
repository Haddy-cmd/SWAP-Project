<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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
