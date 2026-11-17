<?php

namespace App\Http\Controllers\Recipient;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\StipendHistory;
use App\Services\StipendService;
use App\Services\StipendSlipService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StipendClaimController extends Controller
{
    public function __construct(private readonly StipendSlipService $slipService) {}

    /** Stream the beneficiary's claim stub: the student copy (Receiving Slip) only. */
    public function slip(Request $request, int $id): StreamedResponse|JsonResponse
    {
        $stipend = StipendHistory::with(['recipient.profile', 'signatures', 'certifiedBy'])->findOrFail($id);

        abort_if($stipend->user_id !== $request->user()->id, 403, 'This stipend does not belong to you.');
        abort_if(!in_array($stipend->status, ['released', 'claimed', 'certified'], true), 404, 'No stub is available for this stipend.');

        $disk = config('filesystems.documents_disk', 'public');

        // Regenerated on demand when the archived copy is missing (ephemeral disk wiped it, the
        // render at release failed) or is an old 3-part stub. A render failure must reach the
        // student as a readable message, not a bare 500, and the real error the logs.
        try {
            $this->slipService->studentCopyPath($stipend);
        } catch (\Throwable $e) {
            Log::error('Stipend slip render failed', ['stipend_id' => $stipend->id, 'error' => $e->getMessage()]);

            return response()->json([
                'message' => 'Your claim stub could not be generated right now. Please try again in a few minutes or contact the DSA office.',
            ], 503);
        }

        // Opening the stub (view or download) is the recipient receiving it: record it once.
        $view = $request->boolean('view');
        if ($stipend->received_at === null && in_array($stipend->status, StipendService::RELEASED_STATUSES, true)) {
            $stipend->update(['received_at' => now()]);
            AuditLog::record('stipend_received', $stipend, null, ['via' => $view ? 'view' : 'download'], $request->user()->id);
        }

        $name = "swap-claim-stub-{$stipend->control_number}.pdf";

        return $view
            ? Storage::disk($disk)->response($stipend->slip_path, $name, ['Content-Type' => 'application/pdf'], 'inline')
            : Storage::disk($disk)->download($stipend->slip_path, $name);
    }
}
