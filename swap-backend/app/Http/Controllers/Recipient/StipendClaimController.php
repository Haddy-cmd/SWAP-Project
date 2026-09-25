<?php

namespace App\Http\Controllers\Recipient;

use App\Http\Controllers\Controller;
use App\Http\Requests\Stipend\ConfirmStipendReceiptRequest;
use App\Models\StipendHistory;
use App\Resources\StipendResource;
use App\Services\StipendClaimService;
use App\Services\StipendSlipService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StipendClaimController extends Controller
{
    public function __construct(
        private readonly StipendClaimService $claimService,
        private readonly StipendSlipService $slipService,
    ) {}

    /** Stream the beneficiary's claim-stub PDF (their Receiving Slip copy). */
    public function slip(Request $request, int $id): StreamedResponse|JsonResponse
    {
        $stipend = StipendHistory::with(['recipient.profile', 'signatures', 'certifiedBy'])->findOrFail($id);

        abort_if($stipend->user_id !== $request->user()->id, 403, 'This stipend does not belong to you.');
        abort_if(!in_array($stipend->status, ['certified', 'claimed'], true), 404, 'No claim slip is available yet.');

        $disk = config('filesystems.documents_disk', 'public');

        // Regenerate on demand if the archived copy is missing (e.g. ephemeral disk wiped it,
        // or the render at release/confirm failed). A render failure must reach the student as
        // a readable message, not a bare 500 — and the real error must reach the logs.
        if (!$stipend->slip_path || !Storage::disk($disk)->exists($stipend->slip_path)) {
            try {
                $path = $this->slipService->render($stipend);
            } catch (\Throwable $e) {
                Log::error('Stipend slip render failed', ['stipend_id' => $stipend->id, 'error' => $e->getMessage()]);

                return response()->json([
                    'message' => 'Your claim stub could not be generated right now. Please try again in a few minutes or contact the DSA office.',
                ], 503);
            }
            $stipend->update(['slip_path' => $path]);
        }

        return Storage::disk($disk)->download($stipend->slip_path, "swap-claim-stub-{$stipend->control_number}.pdf");
    }

    /** The beneficiary confirms receipt at the Banking Office → status claimed. */
    public function confirmReceipt(ConfirmStipendReceiptRequest $request, int $id): JsonResponse
    {
        $stipend = StipendHistory::findOrFail($id);

        $data = $request->safe()->except(['signature_image']);
        if ($request->hasFile('signature_image')) {
            $data['signature_image_path'] = $request->file('signature_image')
                ->store("stipend-signatures/{$id}", config('filesystems.documents_disk', 'public'));
        }

        $stipend = $this->claimService->confirmReceipt($stipend, $data, $request->user());

        return response()->json([
            'data' => new StipendResource($stipend),
            'message' => 'Receipt confirmed. Your Receiving Slip has been recorded.',
        ]);
    }
}
