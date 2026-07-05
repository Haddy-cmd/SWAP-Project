<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Models\ApplicationDocument;
use App\Support\TokenAuth;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Streams uploaded application documents. Lives outside auth:sanctum so links
 * opened in a new browser tab / <img> still work (token via header or ?token=),
 * but access is policy-checked: only the owner, their supervisor, or an admin
 * may view a document — a valid token alone is NOT enough.
 */
class DocumentFileController extends Controller
{
    public function show(Request $request, int $documentId)
    {
        $viewer = TokenAuth::userFromRequest($request);

        if (!$viewer) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $doc = ApplicationDocument::find($documentId);

        if (!$doc) {
            return response()->json(['message' => 'Document not found.'], 404);
        }

        // Ensure the parent application's user still exists (not soft-deleted).
        $application = $doc->application;
        if (!$application || !$application->user) {
            return response()->json(['message' => 'Document not found.'], 404);
        }

        if (Gate::forUser($viewer)->denies('view', $doc)) {
            return response()->json(['message' => 'You are not authorized to view this document.'], 403);
        }

        $disk = config('filesystems.documents_disk', 'public');

        // Prefer the explicit file_path column; fall back to extracting it from file_url
        // for documents uploaded before the migration added file_path.
        $path = $doc->file_path;

        if (!$path && $doc->file_url) {
            $parsed = parse_url($doc->file_url, PHP_URL_PATH);
            $path = $parsed ? ltrim(preg_replace('#^/storage/#', '', $parsed), '/') : null;
        }

        if (!$path || $path === '0' || str_contains($path, '{DOC_ID}') || str_contains($path, 'api/documents')) {
            return response()->json([
                'message' => 'Document file path is invalid or corrupted. The applicant may need to re-upload this document.',
            ], 404);
        }

        try {
            if (!Storage::disk($disk)->exists($path)) {
                return response()->json([
                    'message' => 'Document file not found on storage. The applicant may need to re-upload this document.',
                ], 404);
            }

            $mimeType = $doc->mime_type ?? Storage::disk($disk)->mimeType($path);
            $fileName = $doc->file_name ?? basename($path);

            $stream = Storage::disk($disk)->readStream($path);
            if (!$stream) {
                throw new \Exception("Could not open read stream for path: {$path}");
            }

            return response()->stream(function () use ($stream) {
                fpassthru($stream);
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }, 200, [
                'Content-Type' => $mimeType,
                'Content-Disposition' => 'inline; filename="' . $fileName . '"',
            ]);
        } catch (\Exception $e) {
            Log::error('Document serve error', [
                'document_id' => $documentId,
                'disk' => $disk,
                'path' => $path,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'message' => 'Failed to retrieve document from storage.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
