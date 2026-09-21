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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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
    ) {}

    /**
     * Release a claim stub for an eligible recipient in one step: create the record,
     * certify it (control number + single-use token + PDF), co-sign it (supervisor +
     * admin), and notify the student it is ready to claim.
     */
    public function releaseClaimStub(array $data, User $admin): StipendHistory
    {
        $amount = $data['amount'] ?? StipendService::DEFAULT_STIPEND_AMOUNT;

        $stipend = DB::transaction(function () use ($data, $amount, $admin) {
            // Releasing the stub IS the certification — no pending limbo (Option C).
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
            ]);

            $stipend->update([
                'control_number' => $this->makeControlNumber($stipend),
                'claim_token' => Str::random(64),
            ]);

            // Supervisor (SWAP Mentor) co-signature — attested by the hours they verified.
            $supervisor = $this->recipientSupervisor((int) $data['user_id']);
            if ($supervisor) {
                $this->repository->addSignature($stipend, [
                    'signatory_role' => StipendSignature::ROLE_SUPERVISOR,
                    'user_id' => $supervisor->id,
                    'printed_name' => $supervisor->name,
                    'method' => StipendSignature::METHOD_AUTHENTICATED,
                    'signed_at' => now(),
                    'remarks' => 'Attested via verified service hours.',
                ]);
            }

            // DSA (admin) certification signature — the money-authorizing act (step-up).
            $this->repository->addSignature($stipend, [
                'signatory_role' => StipendSignature::ROLE_DIRECTOR,
                'user_id' => $admin->id,
                'printed_name' => $admin->name,
                'method' => !empty($data['signature_image_path']) ? StipendSignature::METHOD_DRAWN : StipendSignature::METHOD_AUTHENTICATED,
                'signature_image_path' => $data['signature_image_path'] ?? null,
                'signed_at' => now(),
                'remarks' => $data['remarks'] ?? null,
            ]);

            $stipend->refresh();
            $this->renderSlip($stipend);

            AuditLog::record('released', $stipend, null, $stipend->only(['status', 'control_number', 'amount']), $admin->id);

            return $stipend;
        });

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

    /**
     * The beneficiary confirms receipt at the Banking Office. Records the beneficiary
     * and releasing-officer signatures, consumes the claim token, marks it claimed.
     */
    public function confirmReceipt(StipendHistory $stipend, array $data, User $recipient): StipendHistory
    {
        if (!$stipend->isCertified()) {
            throw new UnprocessableEntityHttpException('This stipend is not available to claim.');
        }

        if ($stipend->user_id !== $recipient->id) {
            throw new UnprocessableEntityHttpException('This stipend does not belong to you.');
        }

        $before = $stipend->only(['status', 'claimed_at']);

        $updated = DB::transaction(function () use ($stipend, $data, $recipient, $before) {
            $fresh = $this->repository->update($stipend, [
                'status' => StipendHistory::STATUS_CLAIMED,
                'claimed_at' => now(),
                'receipt_signed_at' => now(),
                'released_at' => $stipend->released_at ?? now(),
                'releasing_officer_name' => $data['releasing_officer_name'],
                // Single-use: consume the token so the QR can't be replayed.
                'claim_token' => null,
            ]);

            $this->repository->addSignature($fresh, [
                'signatory_role' => StipendSignature::ROLE_BENEFICIARY,
                'user_id' => $recipient->id,
                'printed_name' => $recipient->name,
                'method' => !empty($data['signature_image_path']) ? StipendSignature::METHOD_DRAWN : StipendSignature::METHOD_AUTHENTICATED,
                'signature_image_path' => $data['signature_image_path'] ?? null,
                'signed_at' => now(),
                'remarks' => $data['remarks'] ?? null,
            ]);

            // The releasing officer is external (no portal account) — recorded by name.
            $this->repository->addSignature($fresh, [
                'signatory_role' => StipendSignature::ROLE_RELEASING_OFFICER,
                'user_id' => null,
                'printed_name' => $data['releasing_officer_name'],
                'method' => StipendSignature::METHOD_AUTHENTICATED,
                'signed_at' => now(),
            ]);

            $this->renderSlip($fresh);

            AuditLog::record('claimed', $fresh, $before, $fresh->only(['status', 'claimed_at']), $recipient->id);

            return $fresh;
        });

        // Reuses the existing StipendReleased → "received" notification wiring.
        event(new StipendReleased($updated));

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
    private function makeControlNumber(StipendHistory $stipend): string
    {
        $base = 'SWAP-STP-' . now()->timezone('Asia/Manila')->format('Ym') . '-' . str_pad((string) $stipend->id, 5, '0', STR_PAD_LEFT);

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
        try {
            SendApplicationNotificationJob::dispatch($type, $data)->onQueue('notifications');
        } catch (\Throwable $e) {
            Log::warning('Stipend notification dispatch failed', ['type' => $type, 'error' => $e->getMessage()]);
        }
    }
}
