<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\TokenAuth;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Streams a user's profile photo. Lives outside auth:sanctum so the URL works
 * directly in an <img> tag (token via header or ?token=), but access is
 * policy-checked: only the user themselves, their supervisor, or an admin may
 * view a photo — a valid token alone is NOT enough.
 */
class AvatarController extends Controller
{
    public function show(Request $request, int $userId)
    {
        $viewer = TokenAuth::userFromRequest($request);

        if (!$viewer) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user = User::find($userId);
        if (!$user || !$user->avatar_path) {
            return response()->json(['message' => 'No profile photo.'], 404);
        }

        if (Gate::forUser($viewer)->denies('viewAvatar', $user)) {
            return response()->json(['message' => 'You are not authorized to view this photo.'], 403);
        }

        $disk = config('filesystems.documents_disk', 'public');

        try {
            if (!Storage::disk($disk)->exists($user->avatar_path)) {
                return response()->json(['message' => 'Photo not found on storage.'], 404);
            }

            $stream = Storage::disk($disk)->readStream($user->avatar_path);
            $mime = Storage::disk($disk)->mimeType($user->avatar_path) ?: 'image/jpeg';

            return response()->stream(function () use ($stream) {
                fpassthru($stream);
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }, 200, [
                'Content-Type' => $mime,
                'Cache-Control' => 'private, max-age=300',
            ]);
        } catch (\Throwable $e) {
            Log::error('Avatar serve error', ['user_id' => $userId, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to retrieve photo.'], 500);
        }
    }
}
