<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Repositories\Contracts\StipendClaimRepositoryInterface;
use Illuminate\Http\JsonResponse;

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
    public function __construct(private readonly StipendClaimRepositoryInterface $repository) {}

    public function show(string $claimToken): JsonResponse
    {
        $stipend = $this->repository->findByClaimToken($claimToken);

        if (!$stipend || !$stipend->isCertified()) {
            return response()->json([
                'valid' => false,
                'message' => 'This claim slip is invalid, already claimed, or has been voided.',
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
            ],
        ]);
    }
}
