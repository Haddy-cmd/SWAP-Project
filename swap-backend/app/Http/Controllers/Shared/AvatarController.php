<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Streams a user's profile photo from object storage. Auth is handled here (Bearer
 * header OR ?token= query param) so the URL works directly in an <img> tag.
 */
class AvatarController extends Controller
{
    public function show(Request $request, int $userId)
    {
        $plainTextToken = $request->bearerToken() ?? $request->query('token');
        if (!$plainTextToken) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $accessToken = PersonalAccessToken::findToken($plainTextToken);
        if (!$accessToken || ($accessToken->expires_at && $accessToken->expires_at->isPast())) {
            return response()->json(['message' => 'Invalid or expired token.'], 401);
        }

        $user = User::find($userId);
        if (!$user || !$user->avatar_path) {
            return response()->json(['message' => 'No profile photo.'], 404);
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
