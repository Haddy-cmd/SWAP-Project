<?php

namespace App\Http\Controllers\Supervisor;

use App\Http\Controllers\Controller;
use App\Http\Requests\VerifyLogRequest;
use App\Repositories\Contracts\TimeLogRepositoryInterface;
use App\Resources\TimeLogResource;
use App\Services\VerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VerificationController extends Controller
{
    public function __construct(
        private readonly VerificationService $verificationService,
        private readonly TimeLogRepositoryInterface $timeLogRepository
    ) {}

    public function update(VerifyLogRequest $request, int $logId): JsonResponse
    {
        $log = $this->timeLogRepository->findById($logId);

        if (!$log) {
            return response()->json(['message' => 'Time log not found.'], 404);
        }

        $updated = $this->verificationService->verify(
            $log,
            $request->user(),
            $request->action,
            $request->feedback
        );

        return response()->json([
            'data' => new TimeLogResource($updated),
            'message' => $request->action === 'verified'
                ? 'Hours verified successfully.'
                : 'Log rejected. Student has been notified.',
        ]);
    }

    public function bulkVerify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'log_ids' => ['required', 'array', 'min:1'],
            'log_ids.*' => ['integer'],
        ]);

        $result = $this->verificationService->bulkVerify($validated['log_ids'], $request->user());

        return response()->json([
            'message' => "Verified {$result['verified']} log(s)."
                . ($result['skipped'] ? " {$result['skipped']} skipped." : ''),
            'meta' => $result,
        ]);
    }
}
