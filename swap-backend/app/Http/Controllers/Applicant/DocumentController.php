<?php

namespace App\Http\Controllers\Applicant;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\ApplicationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DocumentController extends Controller
{
    public const MSG_PHOTO_TYPE = 'The 2x2 photo must be a JPG or PNG image.';

    public function __construct(private readonly ApplicationService $applicationService) {}

    public function store(Request $request, int $applicationId): JsonResponse
    {
        // Only the letter of intent may also be a Word document; the rest stay PDF or image.
        // The 2x2 photo becomes the profile photo, so it must be an image.
        $isLetter = $request->input('document_type') === 'letter_of_intent';
        $isPhoto = $request->input('document_type') === 'id_photo';
        $request->validate([
            'document_type' => ['required', 'string', 'in:birth_certificate,cor,grades,income_certificate,letter_of_intent,id_photo,recommendation_letter,other'],
            'file' => ['required', 'file', match (true) {
                $isLetter => 'mimes:pdf,doc,docx,jpg,jpeg,png',
                $isPhoto => 'mimes:jpg,jpeg,png',
                default => 'mimes:pdf,jpg,jpeg,png',
            }, 'max:5120'],
        ], [
            'file.mimes' => match (true) {
                $isLetter => 'Letter of intent must be a PDF, Word, JPG or PNG file.',
                $isPhoto => self::MSG_PHOTO_TYPE,
                default => 'This document must be a PDF, JPG or PNG file.',
            },
            'file.max' => 'The file must be 5 MB or smaller.',
            'file.uploaded' => 'The file must be 5 MB or smaller.',
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

        // The 2x2 photo becomes the applicant's profile photo (the newest one wins; they can
        // replace or remove it on their Profile). It is copied to a separate avatar object so the
        // document itself is never touched (it stays a submission requirement, and is removed on
        // its own if the application is not approved).
        if ($isPhoto) {
            $user = $request->user();
            try {
                $avatarPath = "avatars/{$user->id}/" . basename($path);
                Storage::disk($disk)->copy($path, $avatarPath);
                $old = $user->avatar_path;
                $user->update(['avatar_path' => $avatarPath]);
                if ($old && $old !== $avatarPath) {
                    try { Storage::disk($disk)->delete($old); } catch (\Throwable) { /* best effort */ }
                }
                AuditLog::record('photo_updated', $user, ['avatar_path' => $old], ['avatar_path' => $avatarPath, 'source' => 'application 2x2 photo']);
            } catch (\Throwable $e) {
                Log::warning('Could not set profile photo from ID upload', ['error' => $e->getMessage()]);
            }
        }

        return response()->json(['message' => 'Document uploaded successfully.'], 201);
    }
}
