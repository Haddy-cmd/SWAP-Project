<?php

namespace App\Http\Controllers\Recipient;

use App\Http\Controllers\Controller;
use App\Http\Requests\Stipend\SubmitPromissoryRequest;
use App\Models\PromissoryNote;
use App\Resources\PromissoryNoteResource;
use App\Services\PromissoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PromissoryController extends Controller
{
    public function __construct(private readonly PromissoryService $promissoryService) {}

    /** The student's notes plus whether a new one can be submitted right now. */
    public function index(Request $request): JsonResponse
    {
        $notes = PromissoryNote::with(['reviewer'])
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => [
                'notes' => PromissoryNoteResource::collection($notes),
                'submission' => $this->promissoryService->submissionState($request->user()),
            ],
        ]);
    }

    public function store(SubmitPromissoryRequest $request): JsonResponse
    {
        $note = $this->promissoryService->submit(
            $request->user(),
            $request->safe()->only(['assignment_id', 'reason']),
            $request->file('file')
        );

        return response()->json([
            'data' => new PromissoryNoteResource($note),
            'message' => 'Promissory note submitted. Your supervisor has been notified.',
        ], 201);
    }

    /** Download the student's own promissory document (fetched as a blob, like the slip). */
    public function file(Request $request, int $id): StreamedResponse
    {
        $note = PromissoryNote::findOrFail($id);

        abort_if($note->user_id !== $request->user()->id, 403, 'This promissory note does not belong to you.');

        $disk = config('filesystems.documents_disk', 'public');

        return Storage::disk($disk)->download($note->file_path, $note->file_name);
    }
}
