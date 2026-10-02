<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Stipend\ReleaseBulkStipendRequest;
use App\Http\Requests\Stipend\ReleaseStipendRequest;
use App\Http\Requests\Stipend\SetBankingOfficePinRequest;
use App\Models\AuditLog;
use App\Support\BankingOfficePin;
use App\Http\Requests\Stipend\UnlockStipendRequest;
use App\Http\Requests\Stipend\VoidStipendRequest;
use App\Models\StipendHistory;
use App\Resources\StipendResource;
use App\Services\StipendClaimService;
use App\Services\StipendService;
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
        $records = $this->stipendService->paginateAll(
            $request->only(['status', 'academic_year', 'search'])
        );

        return response()->json([
            'data' => StipendResource::collection($records->items()),
            'meta' => [
                'current_page' => $records->currentPage(),
                'last_page' => $records->lastPage(),
                'per_page' => $records->perPage(),
                'total' => $records->total(),
            ],
        ]);
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
            'message' => 'Claim stub released. The recipient has been notified that it is ready to claim.',
        ], 201);
    }

    public function void(VoidStipendRequest $request, int $id): JsonResponse
    {
        $stipend = StipendHistory::findOrFail($id);

        $stipend = $this->claimService->void($stipend, $request->validated()['reason'], $request->user());

        return response()->json([
            'data' => new StipendResource($stipend),
            'message' => 'Stipend voided.',
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

    /** The releasing officer's name and whether their PIN is set (never the PIN itself). */
    public function bankingOfficePin(): JsonResponse
    {
        return response()->json(['data' => $this->bankingOfficeStatus()]);
    }

    /**
     * Set the releasing officer's name and PIN. The name is what prints on every
     * stub the Banking Office releases; a blank PIN keeps the current one.
     */
    public function setBankingOfficePin(SetBankingOfficePinRequest $request): JsonResponse
    {
        $data = $request->validated();
        $oldName = BankingOfficePin::officerName();
        $pinChanged = !empty($data['pin']);

        BankingOfficePin::set($data['pin'] ?? null, $data['officer_name']);
        AuditLog::record('banking_office_pin_changed', $request->user(),
            ['officer_name' => $oldName],
            ['officer_name' => BankingOfficePin::officerName(), 'pin_changed' => $pinChanged]);

        return response()->json([
            'data' => $this->bankingOfficeStatus(),
            'message' => $pinChanged
                ? 'Releasing officer and PIN saved. Give the PIN only to ' . BankingOfficePin::officerName() . '.'
                : 'Releasing officer updated. The PIN is unchanged.',
        ]);
    }

    private function bankingOfficeStatus(): array
    {
        return [
            'is_set' => BankingOfficePin::isSet(),
            'has_pin' => BankingOfficePin::hasPin(),
            'officer_name' => BankingOfficePin::officerName(),
            'updated_at' => BankingOfficePin::updatedAt(),
        ];
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
