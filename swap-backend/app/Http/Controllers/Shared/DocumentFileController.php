<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Models\ApplicationDocument;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Serves uploaded application documents through the API so that the admin
 * (and any authenticated user with the right role) can view them even when
 * the deployment platform has no persistent public storage symlink (e.g. Render).
 */
class DocumentFileController extends Controller
{
    public function show(Request $request, int $documentId): StreamedResponse
    {
        // When opened in a new browser tab the Authorization header is absent.
        // Accept the token via a query parameter as a fallback.
        $plainTextToken = $request->bearerToken() ?? $request->query('token');

        if (!$plainTextToken) {
            abort(401, 'Unauthenticated.');
        }

        $accessToken = PersonalAccessToken::findToken($plainTextToken);

        if (!$accessToken || ($accessToken->expires_at && $accessToken->expires_at->isPast())) {
            abort(401, 'Invalid or expired token.');
        }

        $doc = ApplicationDocument::findOrFail($documentId);

        $disk = config('filesystems.documents_disk', 'public');

        // Prefer the explicit file_path column; fall back to extracting it from file_url
        // for documents uploaded before the migration added file_path.
        $path = $doc->file_path;

        if (!$path && $doc->file_url) {
            $parsed = parse_url($doc->file_url, PHP_URL_PATH);
            $path = $parsed ? ltrim(preg_replace('#^/storage/#', '', $parsed), '/') : null;
        }

        if (!$path || !Storage::disk($disk)->exists($path)) {
            abort(404, 'Document file not found.');
        }

        $mimeType = $doc->mime_type ?? Storage::disk($disk)->mimeType($path);
        $fileName = $doc->file_name ?? basename($path);

        return Storage::disk($disk)->response($path, $fileName, [
            'Content-Type' => $mimeType,
        ]);
    }
}
