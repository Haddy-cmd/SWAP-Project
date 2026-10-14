<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Stipend\ReleaseBulkStipendRequest;
use App\Http\Requests\Stipend\ReleaseStipendRequest;
use App\Http\Requests\Stipend\RemindStipendRequest;
use App\Http\Requests\Stipend\UnlockStipendRequest;
use App\Http\Requests\Stipend\VoidStipendRequest;
use App\Models\AuditLog;
use App\Models\StipendHistory;
use App\Resources\StipendResource;
use App\Services\StipendClaimService;
use App\Services\StipendReminderService;
use App\Services\StipendService;
use App\Support\CsvDownload;
use App\Support\StipendUnlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class StipendController extends Controller
{
    public function __construct(
        private readonly StipendService $stipendService,
        private readonly StipendClaimService $claimService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'sort' => ['nullable', 'in:new,old,amount,name'],
            'promissory' => ['nullable', 'boolean'],
        ]);
        $filters = $request->only(['status', 'academic_year', 'semester', 'college', 'promissory', 'search', 'sort']);
        $records = $this->stipendService->paginateAll($filters);

        return response()->json([
            'data' => StipendResource::collection($records->items()),
            'meta' => [
                'current_page' => $records->currentPage(),
                'last_page' => $records->lastPage(),
                'per_page' => $records->perPage(),
                'total' => $records->total(),
                // History cards and chip counts (the status chip doesn't narrow them).
                'summary' => $this->stipendService->summary($filters),
                // The Term filter's options (both tabs).
                'terms' => $this->stipendService->terms(),
            ],
        ]);
    }

    /**
     * Stipend → History → CSV: every row the History list shows with the same filters, chip
     * and sort (not just one page). Audited like the report downloads.
     */
    public function export(Request $request)
    {
        $request->validate([
            'sort' => ['nullable', 'in:new,old,amount,name'],
            'promissory' => ['nullable', 'boolean'],
        ]);
        $filters = $request->only(['status', 'academic_year', 'semester', 'college', 'promissory', 'search', 'sort']);
        $records = $this->stipendService->historyQuery($filters)->get();

        $term = !empty($filters['academic_year']) && !empty($filters['semester'])
            ? $filters['academic_year'] . '-' . strtolower(str_replace(' ', '', $filters['semester']))
            : 'all-terms';
        $filename = "stipend-history-{$term}-" . now('Asia/Manila')->format('Ymd') . '.csv';
        AuditLog::record('report_exported', $request->user(), null, [
            'type' => 'stipend-history', 'format' => 'csv', 'rows' => $records->count(),
        ] + array_filter($filters, fn ($v) => $v !== null && $v !== ''));

        $manila = fn ($t) => $t?->copy()->timezone('Asia/Manila')->format('Y-m-d H:i');
        $rows = $records->map(function (StipendHistory $s) use ($manila) {
            $received = $s->received_at ?? ($s->status === StipendHistory::STATUS_CLAIMED ? ($s->claimed_at ?? $s->released_at) : null);

            return [
                $s->control_number,
                $s->recipient?->name,
                $s->recipient?->profile?->student_id_number,
                $s->recipient?->email,
                $s->recipient?->profile?->college,
                trim("{$s->semester} {$s->academic_year}"),
                (float) $s->amount,
                match (true) {
                    $s->status === StipendHistory::STATUS_VOID => 'Void',
                    $received !== null => 'Received',
                    default => 'Released',
                },
                $manila($s->released_at ?? $s->created_at),
                $manila($received),
                $s->via_promissory ? 'Yes' : 'No',
                $s->deficient_hours !== null ? (float) $s->deficient_hours : null,
                $s->void_reason,
                $s->releasedBy?->name,
            ];
        });

        return CsvDownload::stream($filename, [
            'Control no.', 'Recipient', 'Student ID', 'Email', 'College', 'Term', 'Amount', 'Status',
            'Released', 'Received', 'Via promissory', 'Deficient hours', 'Void reason', 'Released by',
        ], $rows);
    }

    /** "Can't release yet" → Remind: tell blocked recipients what's missing (once a day each). */
    public function remind(RemindStipendRequest $request, StipendReminderService $reminders): JsonResponse
    {
        $result = $reminders->remind($request->validated('user_ids'), $request->user());

        return response()->json(['data' => $result]);
    }

    public function eligible(): JsonResponse
    {
        return response()->json([
            'data' => $this->stipendService->eligibleRecipients(),
        ]);
    }

    /**
     * Release a claim stub for an eligible recipient: creates + certifies it in one
     * step, produces the downloadable stub, and notifies the student it's ready.
     */
    public function release(ReleaseStipendRequest $request): JsonResponse
    {
        $disk = config('filesystems.documents_disk', 'public');
        $data = $request->safe()->except(['password', 'unlock_token', 'signature_image']);
        if ($request->hasFile('signature_image')) {
            $data['signature_image_path'] = $request->file('signature_image')->store('stipend-signatures', $disk);
        }

        try {
            $stipend = $this->claimService->releaseClaimStub($data, $request->user());
        } catch (\Throwable $e) {
            // A refused release must not leave its one-off drawing behind.
            if (!empty($data['signature_image_path'])) {
                Storage::disk($disk)->delete($data['signature_image_path']);
            }
            throw $e;
        }

        return response()->json([
            'data' => new StipendResource($stipend),
            'message' => 'Stipend released. The recipient has been notified.',
        ], 201);
    }

    public function void(VoidStipendRequest $request, int $id): JsonResponse
    {
        $stipend = StipendHistory::findOrFail($id);

        $stipend = $this->claimService->void($stipend, $request->validated()['reason'], $request->user());

        return response()->json([
            'data' => new StipendResource($stipend),
            'message' => 'Stipend voided. The recipient can be released a new stub.',
        ]);
    }

    /**
     * Page-level step-up: verify the admin password once and issue a short-lived
     * unlock token for the release/void calls behind the Stipend Management gate.
     */
    public function unlock(UnlockStipendRequest $request): JsonResponse
    {
        $token = StipendUnlock::issue($request->user());

        return response()->json([
            'data' => ['unlock_token' => $token, 'expires_in' => StipendUnlock::TTL_SECONDS],
            'message' => 'Stipend Management unlocked.',
        ]);
    }

    /**
     * Bulk release from the eligible checklist. One bad item never aborts the
     * batch — per-item outcomes are reported in released/skipped.
     */
    public function releaseBulk(ReleaseBulkStipendRequest $request): JsonResponse
    {
        $result = $this->claimService->releaseMany($request->validated()['items'], $request->user());

        $released = count($result['released']);
        $skipped = count($result['skipped']);

        return response()->json([
            'data' => [
                'released' => StipendResource::collection($result['released']),
                'skipped' => $result['skipped'],
            ],
            'message' => "Released {$released} stub(s)." . ($skipped ? " {$skipped} skipped." : ''),
        ]);
    }
}
