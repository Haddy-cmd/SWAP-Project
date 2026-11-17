<?php

namespace App\Http\Controllers\Supervisor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Stipend\ReviewPromissoryRequest;
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

    /** Notes for this supervisor's students (direct + same-office), newest first. */
    public function index(Request $request): JsonResponse
    {
        $base = PromissoryNote::query()
            ->whereHas('assignment', fn ($q) => $q->visibleToSupervisor($request->user()));
        $notes = (clone $base)
            ->with(['student' => fn ($q) => $q->withTrashed(), 'reviewer'])
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            // One semester, e.g. ?academic_year=2026-2027&semester=1st Semester (left out = all).
            ->when($request->query('academic_year'), fn ($q, $year) => $q->where('academic_year', $year))
            ->when($request->query('semester'), fn ($q, $semester) => $q->where('semester', $semester))
            ->orderByDesc('id')
            ->paginate(25);

        return response()->json([
            'data' => PromissoryNoteResource::collection($notes->items()),
            'meta' => [
                'current_page' => $notes->currentPage(),
                'last_page' => $notes->lastPage(),
                'per_page' => $notes->perPage(),
                'total' => $notes->total(),
                // The semesters that have notes, newest first (the page's semester filter).
                'terms' => PromissoryNote::terms($base),
            ],
        ]);
    }

    /** Approve (records lacking hours + fixed +7-day deadline) or reject a note. */
    public function review(ReviewPromissoryRequest $request, int $id): JsonResponse
    {
        $note = PromissoryNote::findOrFail($id);

        $reviewed = $this->promissoryService->review($request->user(), $note, $request->validated());

        return response()->json([
            'data' => new PromissoryNoteResource($reviewed),
            'message' => $reviewed->isApproved()
                ? 'Promissory note approved. The student must render the lacking hours ASAP.'
                : 'Promissory note rejected. The student has been notified.',
        ]);
    }

    /** Download a governed student's promissory document (fetched as a blob). */
    public function file(Request $request, int $id): StreamedResponse
    {
        $note = PromissoryNote::whereHas('assignment', fn ($q) => $q->visibleToSupervisor($request->user()))
            ->findOrFail($id);

        $disk = config('filesystems.documents_disk', 'public');

        return Storage::disk($disk)->response($note->file_path, $note->file_name, [], 'inline'); // inline: the viewer shows it; Download still saves it
    }
}
