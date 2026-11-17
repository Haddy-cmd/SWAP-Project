<?php

namespace App\Support;

use App\Models\StipendHistory;
use App\Services\StipendSlipService;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Attaches a released stipend's claim stub (PDF) to an email. Used when the student can no
 * longer open their Stipend page: a rejected renewal returns them to an applicant account,
 * and the recipient-only stub route is out of reach.
 */
final class ClaimStubAttachment
{
    /** Statuses whose stub was issued to the student (pending has none yet, void is withdrawn). */
    public const ISSUED = [StipendHistory::STATUS_RELEASED, StipendHistory::STATUS_CLAIMED, StipendHistory::STATUS_CERTIFIED];

    /** The student's newest issued stub, optionally outside one term (the renewal's own term). */
    public static function latestFor(int $userId, ?string $exceptYear = null, ?string $exceptSemester = null): ?StipendHistory
    {
        return StipendHistory::where('user_id', $userId)
            ->whereIn('status', self::ISSUED)
            ->when($exceptYear && $exceptSemester, fn ($q) => $q->where(fn ($w) => $w
                ->where('academic_year', '!=', $exceptYear)->orWhere('semester', '!=', $exceptSemester)))
            ->orderByDesc('released_at')->orderByDesc('id')
            ->first();
    }

    /** Adds the stub as "claim-stub-{control}.pdf"; true when attached. Never fails the email. */
    public static function attach(MailMessage $mail, ?int $stipendId): bool
    {
        $stipend = $stipendId ? StipendHistory::find($stipendId) : null;
        if (!$stipend || !in_array($stipend->status, self::ISSUED, true)) {
            return false;
        }

        try {
            $disk = Storage::disk(config('filesystems.documents_disk', 'public'));
            // The student copy only (an old 3-part stub is re-rendered first).
            $path = app(StipendSlipService::class)->studentCopyPath($stipend);
            $name = 'claim-stub' . ($stipend->control_number ? '-' . preg_replace('/[^A-Za-z0-9-]/', '', $stipend->control_number) : '') . '.pdf';
            $mail->attachData($disk->get($path), $name, ['mime' => 'application/pdf']);

            return true;
        } catch (\Throwable $e) {
            Log::warning('Could not attach the claim stub', ['stipend_id' => $stipend->id, 'error' => $e->getMessage()]);

            return false;
        }
    }
}
