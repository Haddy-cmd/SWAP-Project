<?php

namespace App\Services;

use App\Models\StipendHistory;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;

/**
 * The stipend stub, in two copies:
 *  - the STUDENT copy (the Receiving Slip on its own): archived at release and again when
 *    voided, it's what the recipient opens or downloads and what an email attaches;
 *  - the DSA copy (Acknowledgment Receipt + Return Slip): rendered fresh whenever an admin
 *    opens it from Stipend → History, so it always shows the signatures on record.
 * Since 2026-10-05 a release is final: no Banking Office QR and no releasing officer.
 *
 * The PDF is stored on the configured documents disk (R2 in production, see
 * DEPLOYMENT.md "File storage"); a missing file is re-rendered on download.
 */
class StipendSlipService
{
    private const STUDENT_FILE = 'student-copy.pdf';

    /** Render and archive the student copy; returns its path (kept in slip_path). */
    public function render(StipendHistory $stipend): ?string
    {
        $path = "stipend-slips/{$stipend->id}/" . self::STUDENT_FILE;
        $this->disk()->put($path, $this->pdf($stipend, 'student'));

        return $path;
    }

    /**
     * The archived student copy's path, rendering it when it's missing. A stub archived
     * before the split (the whole 3-part "claim-stub.pdf") is replaced the first time it's
     * opened, so the student never gets the DSA's parts.
     */
    public function studentCopyPath(StipendHistory $stipend): string
    {
        $old = $stipend->slip_path;
        if ($old && str_ends_with($old, '/' . self::STUDENT_FILE) && $this->disk()->exists($old)) {
            return $old;
        }

        $path = $this->render($stipend);
        $stipend->update(['slip_path' => $path]);
        if ($old && $old !== $path) {
            try {
                $this->disk()->delete($old);
            } catch (\Throwable) {
                // best effort: slip_path no longer points at it
            }
        }

        return $path;
    }

    /** The DSA copy's PDF bytes, rendered now (not archived). */
    public function dsaCopy(StipendHistory $stipend): string
    {
        return $this->pdf($stipend, 'dsa');
    }

    private function pdf(StipendHistory $stipend, string $copy): string
    {
        // Signatures are always re-read, never taken from an already-loaded relation:
        // the release adds them through signatures()->create() after the stub was
        // created, and loadMissing would keep a stale collection — the ink silently dropped.
        $stipend->loadMissing(['recipient.profile', 'certifiedBy'])->load('signatures.user');

        return Pdf::loadView('stipend.slip', ['stipend' => $stipend, 'copy' => $copy])
            ->setPaper('a4', 'portrait')
            ->output();
    }

    private function disk()
    {
        return Storage::disk(config('filesystems.documents_disk', 'public'));
    }
}
