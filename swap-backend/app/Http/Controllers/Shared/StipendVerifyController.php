<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Http\Requests\Stipend\ReleaseAtBankingOfficeRequest;
use App\Repositories\Contracts\StipendClaimRepositoryInterface;
use App\Services\StipendClaimService;
use App\Support\BankingOfficePin;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * Banking Office verification. Public + token-gated: the officer scans the QR /
 * enters the control number and this confirms the claim is genuine, certified,
 * and unclaimed. The token is single-use — it is consumed (nulled) once the
 * beneficiary confirms receipt, after which this returns "not found", which is
 * what prevents a replayed / photographed slip from being paid twice.
 *
 * Deliberately returns only what the officer needs to pay — never the token,
 * amounts of other records, or anything not on this one claim.
 */
class StipendVerifyController extends Controller
{
    public function __construct(
        private readonly StipendClaimRepositoryInterface $repository,
        private readonly StipendClaimService $claimService,
    ) {}

    private const MSG_INVALID = 'This claim slip is invalid, already claimed, or has been voided.';

    public function show(string $claimToken): JsonResponse
    {
        $stipend = $this->repository->findByClaimToken($claimToken);

        if (!$stipend || !$stipend->isCertified()) {
            return response()->json([
                'valid' => false,
                'message' => self::MSG_INVALID,
            ], 404);
        }

        return response()->json([
            'valid' => true,
            'data' => [
                'control_number' => $stipend->control_number,
                'recipient_name' => $stipend->recipient?->profile?->full_name ?? $stipend->recipient?->name,
                'amount' => $stipend->amount,
                'academic_year' => $stipend->academic_year,
                'semester' => $stipend->semester,
                'period_label' => $stipend->period_label,
                'certified_at' => $stipend->certified_at?->toISOString(),
                'status' => $stipend->status,
                // Who the payout will be recorded under (set by the DSA with the PIN);
                // null until the DSA has set up the Banking Office PIN.
                'releasing_officer_name' => BankingOfficePin::isSet() ? BankingOfficePin::officerName() : null,
            ],
        ]);
    }

    /**
     * The releasing officer records the payout with the Banking Office PIN. This —
     * not the student — marks the stub claimed, restoring the traditional
     * "releasing officer signs the stub" control. The name on the stub is the one
     * the DSA set with the PIN, never typed here. Throttled (see routes).
     */
    public function release(ReleaseAtBankingOfficeRequest $request, string $claimToken): JsonResponse
    {
        $stipend = $this->repository->findByClaimToken($claimToken);

        if (!$stipend || !$stipend->isCertified()) {
            return response()->json(['valid' => false, 'message' => self::MSG_INVALID], 404);
        }

        if (!BankingOfficePin::isSet()) {
            throw new UnprocessableEntityHttpException(BankingOfficePin::MSG_NOT_SET);
        }
        if (!BankingOfficePin::matches($request->validated()['pin'])) {
            throw ValidationException::withMessages(['pin' => [BankingOfficePin::MSG_WRONG]]);
        }

        $stipend = $this->claimService->releaseAtBankingOffice($stipend, BankingOfficePin::officerName());

        return response()->json([
            'data' => [
                'control_number' => $stipend->control_number,
                'status' => $stipend->status,
                'claimed_at' => $stipend->claimed_at?->toISOString(),
                'releasing_officer_name' => $stipend->releasing_officer_name,
            ],
            'message' => 'Payout recorded. The stub is now marked as claimed.',
        ]);
    }
}
