<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Models\TimeLog;
use App\Support\TokenAuth;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Streams a clock-in proof-of-presence selfie. Lives outside auth:sanctum so the
 * URL works in an <img> tag (token via header or ?token=), but access is
 * policy-checked: only the recipient, their supervisor, or an admin may view it.
 */
class AttendancePhotoController extends Controller
{
    public function show(Request $request, int $logId)
    {
        $viewer = TokenAuth::userFromRequest($request);

        if (!$viewer) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $log = TimeLog::find($logId);
        if (!$log || !$log->time_in_photo_path) {
            return response()->json(['message' => 'No attendance photo.'], 404);
        }

        if (Gate::forUser($viewer)->denies('viewPhoto', $log)) {
            return response()->json(['message' => 'You are not authorized to view this photo.'], 403);
        }

        $disk = config('filesystems.documents_disk', 'public');

        try {
            if (!Storage::disk($disk)->exists($log->time_in_photo_path)) {
                return response()->json(['message' => 'Photo not found on storage.'], 404);
            }

            $stream = Storage::disk($disk)->readStream($log->time_in_photo_path);
            $mime = Storage::disk($disk)->mimeType($log->time_in_photo_path) ?: 'image/jpeg';

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
            Log::error('Attendance photo serve error', ['log_id' => $logId, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to retrieve photo.'], 500);
        }
    }
}
