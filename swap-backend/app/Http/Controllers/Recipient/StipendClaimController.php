<?php

namespace App\Http\Controllers\Recipient;

use App\Http\Controllers\Controller;
use App\Models\StipendHistory;
use App\Services\StipendSlipService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StipendClaimController extends Controller
{
    public function __construct(private readonly StipendSlipService $slipService) {}

    /** Stream the beneficiary's claim-stub PDF (their Receiving Slip copy). */
    public function slip(Request $request, int $id): StreamedResponse|JsonResponse
    {
        $stipend = StipendHistory::with(['recipient.profile', 'signatures', 'certifiedBy'])->findOrFail($id);

        abort_if($stipend->user_id !== $request->user()->id, 403, 'This stipend does not belong to you.');
        abort_if(!in_array($stipend->status, ['released', 'claimed', 'certified'], true), 404, 'No stub is available for this stipend.');

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
}
