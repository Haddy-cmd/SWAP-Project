<?php

namespace App\Services;

use App\Events\StipendReleased;
use App\Jobs\SendApplicationNotificationJob;
use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\StipendHistory;
use App\Models\StipendSignature;
use App\Models\User;
use App\Repositories\Contracts\StipendClaimRepositoryInterface;
use App\Support\AfterCommit;
use App\Support\DutySlipControl;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * Drives the digital claim stub lifecycle. Releasing the stub and certifying it are
 * one admin action (Option C): the record is created already `certified`, so the
 * student is immediately notified and can download/print the stub. From there:
 * certified → claimed (receipt confirmed) | void (before claim).
 * See docs/STIPEND_CLAIM_DESIGN.md.
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
    public const MSG_NO_TERM_REPORT = 'This recipient has not submitted their end-of-term narrative report yet.';

    /**
     * Release a claim stub for an eligible recipient in one step: create the record,
     * certify it (control number + single-use token + PDF), co-sign it (supervisor +
     * admin), and notify the student it is ready to claim.
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
     * the specimen and the end-of-term report must exist before release.
     */
    private function missingRequirement(array $row): ?string
    {
        return match (true) {
            !($row['has_signature'] ?? false) => self::MSG_NO_SIGNATURE,
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
            $stipend = $this->createCertifiedStub($data, $amount, $admin, $row);
        } catch (UniqueConstraintViolationException) {
            // The partial unique index is the last line against a concurrent release.
            throw new UnprocessableEntityHttpException(self::MSG_ALREADY_LIVE);
        }

        // After commit, off the request's critical path: a mail outage must not undo a
        // committed release (QUEUE_CONNECTION=sync makes dispatch run inline).
        $this->dispatchQuietly('stipend_available', [
            'user_id' => $stipend->user_id,
            'stipend_id' => $stipend->id,
            'amount' => $stipend->amount,
            'period_label' => $stipend->period_label,
            'control_number' => $stipend->control_number,
        ]);

        return $stipend->load(['recipient.profile', 'certifiedBy', 'signatures']);
    }

    private function createCertifiedStub(array $data, $amount, User $admin, array $row): StipendHistory
    {
        return DB::transaction(function () use ($data, $amount, $admin, $row) {
            $viaPromissory = (bool) ($row['via_promissory'] ?? false);

            // Releasing the stub IS the certification — no pending limbo (Option C).
            // A release through a promissory note keeps the term's shortfall on the
            // paid record itself (and the stub prints it).
            $stipend = StipendHistory::create([
                'user_id' => $data['user_id'],
                'amount' => $amount,
                'academic_year' => $data['academic_year'],
                'semester' => $data['semester'],
                'period_label' => $data['period_label'] ?? null,
                'status' => StipendHistory::STATUS_CERTIFIED,
                'certified_by' => $admin->id,
                'certified_at' => now(),
                'remarks' => $data['remarks'] ?? null,
                'required_hours' => $row['required_hours'] ?? null,
                'via_promissory' => $viaPromissory,
                'promissory_note_id' => $viaPromissory ? ($row['promissory_id'] ?? null) : null,
                'deficient_hours' => $viaPromissory ? ($row['deficient_hours'] ?? null) : null,
                'lacking_hours' => $viaPromissory ? ($row['lacking_hours'] ?? null) : null,
                'makeup_deadline' => $viaPromissory ? ($row['makeup_deadline'] ?? null) : null,
            ]);

            $stipend->update([
                'control_number' => $this->makeControlNumber($stipend),
                'claim_token' => Str::random(64),
            ]);

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
            ->whereIn('status', ['pending', 'certified', 'claimed', 'released'])
            ->exists();
    }

    public const MSG_NOT_CLAIMABLE = 'This stipend is not available to claim.';

    /**
     * The Banking Office releases the money: the releasing officer scans the stub's
     * QR, confirms with their name (and the Banking Office PIN, checked by the
     * caller), and the stub becomes claimed. Records the beneficiary signature (their
     * saved specimen, copied into the stub) and the releasing officer by name, and
     * consumes the single-use token so the stub can't be paid twice.
     */
    public function releaseAtBankingOffice(StipendHistory $stipend, string $releasingOfficer): StipendHistory
    {
        if (!$stipend->isCertified()) {
            throw new UnprocessableEntityHttpException(self::MSG_NOT_CLAIMABLE);
        }

        $recipient = $stipend->recipient()->withTrashed()->firstOrFail();
        $before = $stipend->only(['status', 'claimed_at']);

        $updated = DB::transaction(function () use ($stipend, $releasingOfficer, $recipient, $before) {
            $fresh = $this->repository->update($stipend, [
                'status' => StipendHistory::STATUS_CLAIMED,
                'claimed_at' => now(),
                'receipt_signed_at' => now(),
                'released_at' => $stipend->released_at ?? now(),
                'releasing_officer_name' => $releasingOfficer,
                // Single-use: consume the token so the QR can't be replayed.
                'claim_token' => null,
            ]);

            // The beneficiary signs with their saved specimen (required before the
            // stub is released); the typed fallback keeps older stubs working.
            $beneficiaryImage = $this->snapshotSpecimen($recipient->signature_image_path, $fresh->id, StipendSignature::ROLE_BENEFICIARY);
            $this->repository->addSignature($fresh, [
                'signatory_role' => StipendSignature::ROLE_BENEFICIARY,
                'user_id' => $recipient->id,
                'printed_name' => $recipient->name,
                'method' => $beneficiaryImage ? StipendSignature::METHOD_DRAWN : StipendSignature::METHOD_AUTHENTICATED,
                'signature_image_path' => $beneficiaryImage,
                'signed_at' => now(),
            ]);

            // The releasing officer is external (no portal account) — recorded by name.
            $this->repository->addSignature($fresh, [
                'signatory_role' => StipendSignature::ROLE_RELEASING_OFFICER,
                'user_id' => null,
                'printed_name' => $releasingOfficer,
                'method' => StipendSignature::METHOD_AUTHENTICATED,
                'signed_at' => now(),
            ]);

            $this->renderSlip($fresh);

            // No portal user acted: the audit row records who and where instead.
            AuditLog::record('claimed', $fresh, $before, $fresh->only(['status', 'claimed_at']) + [
                'via' => 'banking_office',
                'releasing_officer_name' => $releasingOfficer,
            ], null);

            return $fresh;
        });

        // Reuses the existing StipendReleased → "received" notification wiring. The
        // claim is committed: a mail failure here must not turn it into a 500 that
        // the student retries into "not available to claim".
        AfterCommit::quietly(fn () => event(new StipendReleased($updated)), 'Stipend received notification', [
            'stipend_id' => $updated->id,
        ]);

        return $updated;
    }

    /** Void a stipend before it is claimed; a claimed record is never mutated. */
    public function void(StipendHistory $stipend, string $reason, User $admin): StipendHistory
    {
        if ($stipend->isClaimed()) {
            throw new UnprocessableEntityHttpException('A claimed stipend cannot be voided. Post a reversing entry instead.');
        }

        $before = $stipend->only(['status']);

        return DB::transaction(function () use ($stipend, $reason, $admin, $before) {
            $fresh = $this->repository->update($stipend, [
                'status' => StipendHistory::STATUS_VOID,
                'voided_at' => now(),
                'void_reason' => $reason,
                // Invalidate the outstanding claim token.
                'claim_token' => null,
            ]);

            AuditLog::record('voided', $fresh, $before, ['status' => $fresh->status, 'void_reason' => $reason], $admin->id);

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

    private function dispatchQuietly(string $type, array $data): void
    {
        AfterCommit::quietly(
            fn () => SendApplicationNotificationJob::dispatch($type, $data)->onQueue('notifications'),
            'Stipend notification dispatch',
            ['type' => $type]
        );
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
