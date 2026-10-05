<?php

namespace App\Services;

use App\Events\StipendReleased;
use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\StipendHistory;
use App\Models\StipendSignature;
use App\Models\User;
use App\Repositories\Contracts\StipendClaimRepositoryInterface;
use App\Support\AfterCommit;
use App\Support\DutySlipControl;
use App\Support\StoredFile;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * The stipend release. Releasing is final and a single admin action: once the recipient
 * is eligible (hours met or an approved promissory note, a saved signature, the
 * end-of-term report) the stub is created `released`, signed by the supervisor, the
 * director and the beneficiary, archived as a PDF, and the student is notified. There is
 * no claim QR, Banking Office scan or releasing officer any more (2026-10-05). A released
 * stub can still be voided with a reason, which frees the recipient for a new release.
 * Legacy rows: `certified` (migrated to released), `claimed` (paid at the Banking Office).
 */
class StipendClaimService
{
    public function __construct(
        private readonly StipendClaimRepositoryInterface $repository,
        private readonly StipendSlipService $slipService,
        private readonly StipendService $stipendService,
    ) {}

    public const MSG_NO_POSITION_TITLE = 'Set your position title on your Profile page before releasing stipends.';
    public const MSG_ALREADY_LIVE = 'This recipient already has a live stipend for this period.';
    public const MSG_NOT_ELIGIBLE = 'This recipient is not eligible for a stipend for this period.';
    public const MSG_NO_SIGNATURE = 'This recipient has not saved a digital signature yet.';
    public const MSG_SIGNATURE_LOST = "This recipient's saved signature can't be found in storage. Ask them to draw it again on their Profile.";
    public const MSG_NO_TERM_REPORT = 'This recipient has not submitted their end-of-term narrative report yet.';

    /**
     * Release the stipend to an eligible recipient in one step: create the record as
     * released, with its control number, the three signatures and the PDF, and notify
     * the student.
     */
    public function releaseClaimStub(array $data, User $admin): StipendHistory
    {
        $this->assertCanRelease($admin);

        // Same rules as the bulk checklist: never a second live stub for a period,
        // and only for recipients who met their hours (or hold an approved note).
        $userId = (int) $data['user_id'];
        if ($this->hasLiveStipend($userId, $data['academic_year'], $data['semester'])) {
            throw new UnprocessableEntityHttpException(self::MSG_ALREADY_LIVE);
        }
        $row = $this->eligibleByKey()->get($this->periodKey($data));
        if (!$row) {
            throw new UnprocessableEntityHttpException(self::MSG_NOT_ELIGIBLE);
        }
        if ($missing = $this->missingRequirement($row)) {
            throw new UnprocessableEntityHttpException($missing);
        }

        return $this->issueStub($data, $admin, $row);
    }

    /**
     * The director's title prints on every stub — refuse to certify without it.
     * Bulk inherits this: one missing title fails the whole batch, correctly,
     * since it is an admin-level precondition, not a per-item problem.
     */
    private function assertCanRelease(User $admin): void
    {
        if (empty($admin->position_title)) {
            throw new UnprocessableEntityHttpException(self::MSG_NO_POSITION_TITLE);
        }
    }

    /** Everyone payable on hours right now (StipendService rules), keyed user|year|semester. */
    private function eligibleByKey(): \Illuminate\Support\Collection
    {
        return collect($this->stipendService->eligibleRecipients())
            ->keyBy(fn ($e) => $this->periodKey($e));
    }

    /**
     * The stub carries the beneficiary's signature and closes the term, so both
     * the specimen and the end-of-term report must exist before release. The
     * specimen's file is checked too (one lookup, only at release): a file lost
     * from storage would put an inkless stub in the student's hands.
     */
    private function missingRequirement(array $row): ?string
    {
        return match (true) {
            !($row['has_signature'] ?? false) => self::MSG_NO_SIGNATURE,
            (bool) User::find((int) $row['user_id'])?->signatureFileMissing() => self::MSG_SIGNATURE_LOST,
            !($row['narrative_submitted'] ?? false) => self::MSG_NO_TERM_REPORT,
            default => null,
        };
    }

    private function periodKey(array $row): string
    {
        return "{$row['user_id']}|{$row['academic_year']}|{$row['semester']}";
    }

    /**
     * Create, certify, co-sign and archive one stub. Callers have already run the
     * guards; `$row` is the recipient's eligible row (StipendService), which says
     * whether the release goes through a promissory note.
     */
    private function issueStub(array $data, User $admin, array $row): StipendHistory
    {
        $amount = $data['amount'] ?? StipendService::DEFAULT_STIPEND_AMOUNT;

        try {
            $stipend = $this->createReleasedStub($data, $amount, $admin, $row);
        } catch (UniqueConstraintViolationException) {
            // The partial unique index is the last line against a concurrent release.
            throw new UnprocessableEntityHttpException(self::MSG_ALREADY_LIVE);
        }

        // After commit, off the request's critical path: a mail outage must not undo a
        // committed release (QUEUE_CONNECTION=sync makes dispatch run inline).
        AfterCommit::quietly(fn () => event(new StipendReleased($stipend)), 'Stipend released notification', [
            'stipend_id' => $stipend->id,
        ]);

        return $stipend->load(['recipient.profile', 'certifiedBy', 'signatures']);
    }

    private function createReleasedStub(array $data, $amount, User $admin, array $row): StipendHistory
    {
        return DB::transaction(function () use ($data, $amount, $admin, $row) {
            $viaPromissory = (bool) ($row['via_promissory'] ?? false);

            // Releasing is final: certified and released in the same moment. A release
            // through a promissory note keeps the term's shortfall on the paid record
            // itself (and the stub prints it).
            $stipend = StipendHistory::create([
                'user_id' => $data['user_id'],
                'amount' => $amount,
                'academic_year' => $data['academic_year'],
                'semester' => $data['semester'],
                'period_label' => $data['period_label'] ?? null,
                'status' => StipendHistory::STATUS_RELEASED,
                'certified_by' => $admin->id,
                'certified_at' => now(),
                'released_by' => $admin->id,
                'released_at' => now(),
                'remarks' => $data['remarks'] ?? null,
                'required_hours' => $row['required_hours'] ?? null,
                'via_promissory' => $viaPromissory,
                'promissory_note_id' => $viaPromissory ? ($row['promissory_id'] ?? null) : null,
                'deficient_hours' => $viaPromissory ? ($row['deficient_hours'] ?? null) : null,
                'lacking_hours' => $viaPromissory ? ($row['lacking_hours'] ?? null) : null,
            ]);

            $stipend->update(['control_number' => $this->makeControlNumber($stipend)]);

            // Supervisor (SWAP Mentor) co-signature — attested by the hours they verified.
            // Carries their drawn specimen when they saved one on their profile.
            $supervisor = $this->recipientSupervisor((int) $data['user_id']);
            if ($supervisor) {
                $this->repository->addSignature($stipend, [
                    'signatory_role' => StipendSignature::ROLE_SUPERVISOR,
                    'user_id' => $supervisor->id,
                    'printed_name' => $supervisor->name,
                    'method' => $supervisor->signature_image_path
                        ? StipendSignature::METHOD_DRAWN
                        : StipendSignature::METHOD_AUTHENTICATED,
                    'signature_image_path' => $this->snapshotSpecimen(
                        $supervisor->signature_image_path, $stipend->id, StipendSignature::ROLE_SUPERVISOR
                    ),
                    'signed_at' => now(),
                    'remarks' => 'Attested via verified service hours.',
                ]);
            }

            // DSA (admin) certification signature — the money-authorizing act (step-up).
            // A per-release drawing wins; otherwise the admin's saved specimen applies.
            $directorImage = $data['signature_image_path']
                ?? $this->snapshotSpecimen($admin->signature_image_path, $stipend->id, StipendSignature::ROLE_DIRECTOR);
            $this->repository->addSignature($stipend, [
                'signatory_role' => StipendSignature::ROLE_DIRECTOR,
                'user_id' => $admin->id,
                'printed_name' => $admin->name,
                'method' => $directorImage ? StipendSignature::METHOD_DRAWN : StipendSignature::METHOD_AUTHENTICATED,
                'signature_image_path' => $directorImage,
                'signed_at' => now(),
                'remarks' => $data['remarks'] ?? null,
            ]);

            // The beneficiary signs with their saved specimen, copied into the stub
            // (a saved signature whose file exists is a release requirement).
            $recipient = User::withTrashed()->findOrFail($data['user_id']);
            $beneficiaryImage = $this->snapshotSpecimen($recipient->signature_image_path, $stipend->id, StipendSignature::ROLE_BENEFICIARY);
            $this->repository->addSignature($stipend, [
                'signatory_role' => StipendSignature::ROLE_BENEFICIARY,
                'user_id' => $recipient->id,
                'printed_name' => $recipient->name,
                'method' => $beneficiaryImage ? StipendSignature::METHOD_DRAWN : StipendSignature::METHOD_AUTHENTICATED,
                'signature_image_path' => $beneficiaryImage,
                'signed_at' => now(),
                'remarks' => 'Released by the DSA.',
            ]);

            $stipend->refresh();

            // The override stays readable in the remarks too — but only when the
            // release really went through the note. A student who met the hours
            // (e.g. after a makeup) is paid normally even if a note was approved.
            if ($viaPromissory && $stipend->promissory_note_id) {
                $via = "via approved promissory #{$stipend->promissory_note_id}";
                if (!str_contains((string) $stipend->remarks, $via)) {
                    $stipend->update(['remarks' => trim(($stipend->remarks ? $stipend->remarks.' · ' : '').$via)]);
                }
            }

            $this->renderSlip($stipend);

            AuditLog::record('released', $stipend, null, $stipend->only(['status', 'control_number', 'amount']), $admin->id);

            return $stipend;
        });
    }

    /**
     * Bulk release from the eligible checklist. Each item follows the single-release
     * rules; one bad item never aborts the batch (mirrors VerificationService::bulkVerify).
     *
     * @return array{released: StipendHistory[], skipped: array<int, array{user_id: int, reason: string}>}
     */
    public function releaseMany(array $items, User $admin): array
    {
        // Admin-level precondition: fail the whole batch, not per item.
        $this->assertCanRelease($admin);

        // Computed once for the batch; issueStub() skips the per-call guard.
        $eligible = $this->eligibleByKey();

        $released = [];
        $skipped = [];

        foreach ($items as $item) {
            $row = $eligible->get($this->periodKey($item));
            if (!$row) {
                $skipped[] = ['user_id' => (int) $item['user_id'], 'reason' => 'Not eligible for this period.'];
                continue;
            }
            if ($missing = $this->missingRequirement($row)) {
                $skipped[] = ['user_id' => (int) $item['user_id'], 'reason' => $missing];
                continue;
            }
            // Re-check live rows per item so an intra-batch duplicate is skipped.
            if ($this->hasLiveStipend((int) $item['user_id'], $item['academic_year'], $item['semester'])) {
                $skipped[] = ['user_id' => (int) $item['user_id'], 'reason' => 'Already has a live stipend for this period.'];
                continue;
            }
            try {
                $released[] = $this->issueStub($item, $admin, $row);
            } catch (UnprocessableEntityHttpException) {
                // Lost a race to a concurrent release (unique index).
                $skipped[] = ['user_id' => (int) $item['user_id'], 'reason' => 'Already has a live stipend for this period.'];
            } catch (\Throwable $e) {
                // Generic reason to the caller; the real error goes to the log.
                $skipped[] = ['user_id' => (int) $item['user_id'], 'reason' => 'Release failed.'];
                Log::warning('Bulk stipend release item failed', ['user_id' => $item['user_id'], 'error' => $e->getMessage()]);
            }
        }

        return ['released' => $released, 'skipped' => $skipped];
    }

    /** Any not-yet-closed stipend for the period (mirrors the eligibleRecipients dedupe set). */
    private function hasLiveStipend(int $userId, string $academicYear, string $semester): bool
    {
        return StipendHistory::where('user_id', $userId)
            ->where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->whereIn('status', StipendHistory::LIVE_STATUSES)
            ->exists();
    }

    public const MSG_NOT_VOIDABLE = 'This stub was received at the Banking Office and can\'t be voided.';
    public const MSG_ALREADY_VOID = 'This stub is already void.';

    /**
     * Void a released stub (e.g. the wrong recipient or amount): with a reason, audit-logged,
     * and the recipient becomes eligible for a new release. A legacy stub paid at the
     * Banking Office (`claimed`) is never mutated.
     */
    public function void(StipendHistory $stipend, string $reason, User $admin): StipendHistory
    {
        if ($stipend->isClaimed()) {
            throw new UnprocessableEntityHttpException(self::MSG_NOT_VOIDABLE);
        }
        if ($stipend->status === StipendHistory::STATUS_VOID) {
            throw new UnprocessableEntityHttpException(self::MSG_ALREADY_VOID);
        }

        $before = $stipend->only(['status']);

        return DB::transaction(function () use ($stipend, $reason, $admin, $before) {
            $fresh = $this->repository->update($stipend, [
                'status' => StipendHistory::STATUS_VOID,
                'voided_at' => now(),
                'void_reason' => $reason,
            ]);

            AuditLog::record('voided', $fresh, $before, ['status' => $fresh->status, 'void_reason' => $reason], $admin->id);
            // The archived PDF now prints VOID.
            $this->renderSlip($fresh);

            return $fresh;
        });
    }

    /** The supervisor of record for a recipient — their active assignment's supervisor. */
    private function recipientSupervisor(int $userId): ?User
    {
        return Assignment::where('user_id', $userId)
            ->where('status', 'active')
            ->with('supervisor')
            ->first()?->supervisor;
    }

    /** SWAP-STP-YYYYMM-#####, unique; a collision (re-issue) bumps a revision suffix. */
    /**
     * The stub's control number carries the student ID and the term, like the duty
     * slip: SWAP-STP-{STUDENTID}-{YYYY}{SEM}, e.g. SWAP-STP-202512345-2627S2. A stub
     * re-issued after a void gets -R2, -R3…; a recipient without a student ID on
     * file falls back to U{userId}.
     */
    private function makeControlNumber(StipendHistory $stipend): string
    {
        $stipend->loadMissing('recipient.profile');
        $sid = DutySlipControl::studentRef($stipend->recipient?->profile?->student_id_number);
        $base = 'SWAP-STP-' . ($sid !== '' ? $sid : 'U' . $stipend->user_id)
            . '-' . DutySlipControl::termCode($stipend->academic_year, $stipend->semester);

        $candidate = $base;
        $rev = 2;
        while ($this->repository->controlNumberExists($candidate)) {
            $candidate = "{$base}-R{$rev}";
            $rev++;
        }

        return $candidate;
    }

    /**
     * After a user saves a new specimen: the stubs they signed whose ink file was lost
     * from storage take the new specimen, and their stored PDF is dropped so the next
     * download re-renders it with ink. Rows that never had a drawing are left alone.
     * Never fails the save that called it. Returns how many stubs got their ink back.
     */
    public function restoreLostInk(User $user): int
    {
        if (!$user->signature_image_path) {
            return 0;
        }

        $restored = [];
        try {
            $rows = StipendSignature::with('stipend')
                ->where('user_id', $user->id)
                ->where('method', StipendSignature::METHOD_DRAWN)
                ->whereNotNull('signature_image_path')
                ->whereHas('stipend', fn ($q) => $q->whereIn('status', [StipendHistory::STATUS_RELEASED, StipendHistory::STATUS_CERTIFIED, StipendHistory::STATUS_CLAIMED]))
                ->get();

            foreach ($rows as $row) {
                if (StoredFile::missing($row->signature_image_path) !== true) {
                    continue;
                }
                $before = $row->only(['signatory_role', 'signature_image_path']);
                $copy = $this->snapshotSpecimen($user->signature_image_path, $row->stipend_history_id, $row->signatory_role);
                $row->update(['signature_image_path' => $copy]);
                $this->dropSlip($row->stipend);
                AuditLog::record('stipend_signature_restored', $row->stipend, $before, $row->only(['signatory_role', 'signature_image_path']), $user->id);
                $restored[$row->stipend_history_id] = true;
            }
        } catch (\Throwable $e) {
            Log::warning('Restoring lost stub ink failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
        }

        return count($restored);
    }

    /** Forget a stub's stored PDF; the download (Recipient\StipendClaimController::slip) renders a fresh one. */
    private function dropSlip(StipendHistory $stipend): void
    {
        if (!$stipend->slip_path) {
            return;
        }
        try {
            Storage::disk(config('filesystems.documents_disk', 'public'))->delete($stipend->slip_path);
        } catch (\Throwable) {
            // best effort: the cleared path alone makes the download re-render
        }
        $stipend->update(['slip_path' => null]);
    }

    /** Render + archive the slip PDF; non-fatal so a rendering hiccup never blocks the claim. */
    private function renderSlip(StipendHistory $stipend): void
    {
        try {
            $path = $this->slipService->render($stipend);
            if ($path) {
                $stipend->update(['slip_path' => $path]);
            }
        } catch (\Throwable $e) {
            Log::warning('Stipend slip render failed', ['stipend_id' => $stipend->id, 'error' => $e->getMessage()]);
        }
    }


    /**
     * Freeze a signer's specimen into the stub at signing time. Signature rows used
     * to point at the user's *current* specimen file, which is deleted when they
     * replace it — so any later re-render of an already-signed stub lost its ink
     * while the row still said "drawn". The copy is the receipt's own record.
     * Falls back to the live path if the copy can't be made (never blocks signing).
     */
    private function snapshotSpecimen(?string $path, int $stipendId, string $role): ?string
    {
        if (!$path) {
            return null;
        }

        $disk = Storage::disk(config('filesystems.documents_disk', 'public'));
        $ext = pathinfo($path, PATHINFO_EXTENSION) ?: 'png';
        $copy = "stipend-signatures/{$stipendId}/{$role}.{$ext}";

        try {
            if ($disk->exists($path)) {
                $disk->delete($copy);
                if ($disk->copy($path, $copy)) {
                    return $copy;
                }
            }
        } catch (\Throwable $e) {
            Log::warning('Signature snapshot failed', ['stipend_id' => $stipendId, 'role' => $role, 'error' => $e->getMessage()]);
        }

        return $path;
    }
}
