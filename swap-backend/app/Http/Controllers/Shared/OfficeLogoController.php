<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Models\Office;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Office logos, streamed from the documents disk like avatars and documents. Linking
 * straight to the disk only works for a public bucket; with a private Cloudflare R2
 * bucket the browser got an access error and showed a broken image. Logos are not
 * sensitive (they show on the public QR page and to every recipient), so no login.
 */
class OfficeLogoController extends Controller
{
    public function show(int $id)
    {
        $office = Office::find($id);
        if (!$office || !$office->logo_path) {
            return response()->json(['message' => 'No logo.'], 404);
        }

        $disk = config('filesystems.documents_disk', 'public');

        try {
            if (!Storage::disk($disk)->exists($office->logo_path)) {
                return response()->json(['message' => 'Logo not found on storage.'], 404);
            }

            $stream = Storage::disk($disk)->readStream($office->logo_path);
            $mime = Storage::disk($disk)->mimeType($office->logo_path) ?: 'image/png';

            return response()->stream(function () use ($stream) {
                fpassthru($stream);
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }, 200, [
                'Content-Type' => $mime,
                // The URL carries ?v= of the stored path, so a replaced logo gets a new URL.
                'Cache-Control' => 'public, max-age=86400',
            ]);
        } catch (\Throwable $e) {
            Log::error('Office logo serve error', ['office_id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to retrieve the logo.'], 500);
        }
    }
}
