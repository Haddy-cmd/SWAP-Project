<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Models\AnnouncementAttachment;
use App\Notifications\AnnouncementNotification;
use App\Support\TokenAuth;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Streams a photo or document sent with an announcement. Outside auth:sanctum so it works
 * as an <img src> or a new tab (token via header or ?token=), but only an admin or someone
 * who received the announcement (their own portal copy) may open it.
 */
class AnnouncementAttachmentController extends Controller
{
    public const MSG_GONE = 'This file is no longer available.';

    public function show(Request $request, int $id, int $attachmentId)
    {
        $viewer = TokenAuth::userFromRequest($request);
        if (!$viewer) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $file = AnnouncementAttachment::where('announcement_id', $id)->find($attachmentId);
        if (!$file) {
            return response()->json(['message' => self::MSG_GONE], 404);
        }

        $received = DB::table('notifications')
            ->where('type', AnnouncementNotification::class)
            ->where('notifiable_type', get_class($viewer))->where('notifiable_id', $viewer->id)
            ->where('data', 'like', '%"announcement_id":' . $id . '}')
            ->exists();
        if (!$viewer->isAdmin() && !$received) {
            return response()->json(['message' => 'You are not authorized to view this file.'], 403);
        }

        $disk = config('filesystems.documents_disk', 'public');
        try {
            if (!Storage::disk($disk)->exists($file->file_path)) {
                return response()->json(['message' => self::MSG_GONE], 404);
            }
            $stream = Storage::disk($disk)->readStream($file->file_path);
        } catch (\Throwable $e) {
            Log::error('Announcement attachment serve error', ['attachment_id' => $file->id, 'error' => $e->getMessage()]);

            return response()->json(['message' => 'Could not open the file. Try again later.'], 500);
        }

        // Photos and PDFs open in the browser; office documents download.
        $inline = $file->is_image || $file->mime_type === 'application/pdf';
        $name = str_replace(['"', "\r", "\n"], '', $file->file_name);

        return response()->stream(function () use ($stream) {
            fpassthru($stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
        }, 200, [
            'Content-Type' => $file->mime_type,
            'Content-Disposition' => ($inline ? 'inline' : 'attachment') . '; filename="' . $name . '"',
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
