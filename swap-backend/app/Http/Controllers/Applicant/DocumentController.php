<?php

namespace App\Http\Controllers\Applicant;

use App\Http\Controllers\Controller;
use App\Services\ApplicationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        $path = $file->store("documents/{$applicationId}", $disk);
        $url = Storage::disk($disk)->url($path);

        $this->applicationService->attachDocument($application, [
            'document_type' => $request->document_type,
            'file_path' => $path,
            'file_url' => $url,
            'file_name' => $file->getClientOriginalName(),
            'file_size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
        ]);

        return response()->json(['message' => 'Document uploaded successfully.'], 201);
    }
}
