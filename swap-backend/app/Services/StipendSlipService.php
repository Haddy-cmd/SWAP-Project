<?php

namespace App\Services;

use App\Models\StipendHistory;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;

/**
 * Renders the 3-part claim stub (Acknowledgment Receipt · Return Slip · Receiving
 * Slip) as one archived PDF. The same document is re-rendered at certification and
 * again at receipt, so it always reflects the signatures captured so far.
 *
 * NOTE: the PDF is stored on the configured documents disk, which defaults to the
 * local 'public' disk. On Render's free tier that disk is ephemeral — receipts will
 * not survive a redeploy until this is pointed at object storage (see
 * docs/AUDIT_2026-09.md R1).
 */
class StipendSlipService
{
    public function render(StipendHistory $stipend): ?string
    {
        $stipend->loadMissing(['recipient.profile', 'signatures', 'certifiedBy']);

        $pdf = Pdf::loadView('stipend.slip', ['stipend' => $stipend])
            ->setPaper('a4', 'portrait');

        $disk = config('filesystems.documents_disk', 'public');
        $path = "stipend-slips/{$stipend->id}/claim-stub.pdf";

        Storage::disk($disk)->put($path, $pdf->output());

        return $path;
    }
}
