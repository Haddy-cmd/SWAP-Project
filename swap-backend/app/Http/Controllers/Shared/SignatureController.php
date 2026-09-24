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
 * Streams a user's signature specimen. Same shape as the avatar endpoint:
 * outside auth:sanctum so <img> tags work (token via header or ?token=), with
 * the same policy circle (self, admin, supervising supervisor).
 */
class SignatureController extends Controller
{
    public function show(Request $request, int $userId)
    {
        $viewer = TokenAuth::userFromRequest($request);

        if (!$viewer) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user = User::find($userId);
        if (!$user || !$user->signature_image_path) {
            return response()->json(['message' => 'No signature on file.'], 404);
        }

        if (Gate::forUser($viewer)->denies('viewSignature', $user)) {
            return response()->json(['message' => 'You are not authorized to view this signature.'], 403);
        }

        $disk = config('filesystems.documents_disk', 'public');

        try {
            if (!Storage::disk($disk)->exists($user->signature_image_path)) {
                return response()->json(['message' => 'Signature not found on storage.'], 404);
            }

            $stream = Storage::disk($disk)->readStream($user->signature_image_path);
            $mime = Storage::disk($disk)->mimeType($user->signature_image_path) ?: 'image/png';

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
            Log::error('Signature serve error', ['user_id' => $userId, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to retrieve signature.'], 500);
        }
    }
}
