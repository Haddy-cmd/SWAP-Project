<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Models\ApplicationDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Serves uploaded application documents through the API so that the admin
 * (and any authenticated user with the right role) can view them even when
 * the deployment platform has no persistent public storage symlink (e.g. Render).
 */
class DocumentFileController extends Controller
{
    public function show(Request $request, int $documentId)
    {
        // When opened in a new browser tab the Authorization header is absent.
        // Accept the token via a query parameter as a fallback.
        $plainTextToken = $request->bearerToken() ?? $request->query('token');

        if (!$plainTextToken) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $accessToken = PersonalAccessToken::findToken($plainTextToken);

        if (!$accessToken || ($accessToken->expires_at && $accessToken->expires_at->isPast())) {
            return response()->json(['message' => 'Invalid or expired token.'], 401);
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

        $disk = config('filesystems.documents_disk', 'public');

        // Prefer the explicit file_path column; fall back to extracting it from file_url
        // for documents uploaded before the migration added file_path.
        $path = $doc->file_path;

        if (!$path && $doc->file_url) {
            $parsed = parse_url($doc->file_url, PHP_URL_PATH);
            $path = $parsed ? ltrim(preg_replace('#^/storage/#', '', $parsed), '/') : null;
        }

        if (!$path) {
            return response()->json(['message' => 'Document file path is missing.'], 404);
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
