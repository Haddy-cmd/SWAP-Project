<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PromissoryNote;
use App\Resources\PromissoryNoteResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PromissoryController extends Controller
{
    /** All promissory notes, so the DSA sees what supervisors approved. */
    public function index(Request $request): JsonResponse
    {
        $notes = PromissoryNote::with(['student', 'reviewer'])
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->orderByDesc('id')
            ->paginate(25);

        return response()->json([
            'data' => PromissoryNoteResource::collection($notes->items()),
            'meta' => [
                'current_page' => $notes->currentPage(),
                'last_page' => $notes->lastPage(),
                'per_page' => $notes->perPage(),
                'total' => $notes->total(),
            ],
        ]);
    }

    /** Download any promissory document (DSA visibility over all notes). */
    public function file(int $id): StreamedResponse
    {
        $note = PromissoryNote::findOrFail($id);

        $disk = config('filesystems.documents_disk', 'public');

        return Storage::disk($disk)->download($note->file_path, $note->file_name);
    }
}
