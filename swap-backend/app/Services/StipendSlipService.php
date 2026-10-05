<?php

namespace App\Services;

use App\Models\StipendHistory;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;

/**
 * Renders the 3-part stipend stub (Acknowledgment Receipt · Return Slip · Receiving
 * Slip) as one archived PDF, at release and again when voided, so it always shows the
 * signatures on record. Since 2026-10-05 a release is final: no Banking Office QR and no
 * releasing officer — the beneficiary's signature is attached at release.
 *
 * The PDF is stored on the configured documents disk (R2 in production, see
 * DEPLOYMENT.md "File storage"); a missing file is re-rendered on download.
 */
class StipendSlipService
{
    public function render(StipendHistory $stipend): ?string
    {
        // Signatures are always re-read, never taken from an already-loaded relation:
        // the release adds them through signatures()->create() after the stub was
        // created, and loadMissing would keep a stale collection — the ink silently dropped.
        $stipend->loadMissing(['recipient.profile', 'certifiedBy'])->load('signatures.user');

        $pdf = Pdf::loadView('stipend.slip', ['stipend' => $stipend])
            ->setPaper('a4', 'portrait');

        $disk = config('filesystems.documents_disk', 'public');
        $path = "stipend-slips/{$stipend->id}/claim-stub.pdf";

        Storage::disk($disk)->put($path, $pdf->output());

        return $path;
    }
}
