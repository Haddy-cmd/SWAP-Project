<?php

namespace App\Http\Controllers\Applicant;

use App\Http\Controllers\Controller;
use App\Services\ApplicationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DocumentController extends Controller
{
    public function __construct(private readonly ApplicationService $applicationService) {}

    public function store(Request $request, int $applicationId): JsonResponse
    {
        $request->validate([
            'document_type' => ['required', 'string', 'in:birth_certificate,cor,grades,income_certificate,letter_of_intent,id_photo,recommendation_letter,other'],
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
        ]);

        $application = $this->applicationService->getApplicationById($applicationId);

        if (!$application || $application->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Application not found.'], 404);
        }

        $file = $request->file('file');
        $disk = config('filesystems.documents_disk', 'public');

        try {
            $path = $file->store("documents/{$applicationId}", $disk);
            if ($path === false) {
                throw new \Exception("File storage driver returned false (check credentials and permissions).");
            }
        } catch (\Throwable $e) {
            // Flysystem wraps the real driver error (the S3/R2 API response) as the
            // previous exception — unwrap to the root so storage misconfig is
            // actually diagnosable (e.g. SignatureDoesNotMatch, AccessDenied).
            $root = $e;
            while ($root->getPrevious()) {
                $root = $root->getPrevious();
            }
            Log::error('Document upload failed', [
                'disk' => $disk,
                'error' => $e->getMessage(),
                'cause' => $root->getMessage(),
            ]);
            return response()->json([
                'message' => 'Failed to upload document to storage.',
                'error' => $e->getMessage(),
                'cause' => $root->getMessage(),
            ], 500);
        }

        // Build the API-served URL (works regardless of storage driver).
        $url = rtrim(config('app.url'), '/') . '/api/documents/{DOC_ID}/file';

        $this->applicationService->attachDocument($application, [
            'document_type' => $request->document_type,
            'file_path' => $path,
            'file_url' => $url,
            'file_name' => $file->getClientOriginalName(),
            'file_size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
        ]);

        // The 2x2 ID photo doubles as the applicant's default profile photo, but only
        // until they set a custom one. Copy it to a separate avatar object so the
        // document itself is never touched (it stays a submission requirement).
        if ($request->document_type === 'id_photo') {
            $user = $request->user();
            if (empty($user->avatar_path)) {
                try {
                    $avatarPath = "avatars/{$user->id}/" . basename($path);
                    Storage::disk($disk)->copy($path, $avatarPath);
                    $user->update(['avatar_path' => $avatarPath]);
                } catch (\Throwable $e) {
                    Log::warning('Could not set profile photo from ID upload', ['error' => $e->getMessage()]);
                }
            }
        }

        return response()->json(['message' => 'Document uploaded successfully.'], 201);
    }
}
