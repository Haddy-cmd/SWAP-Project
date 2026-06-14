<?php

namespace App\Services;

use App\Events\HoursRejected;
use App\Events\HoursVerified;
use App\Models\AuditLog;
use App\Models\TimeLog;
use App\Models\User;
use App\Models\Verification;
use App\Repositories\Contracts\TimeLogRepositoryInterface;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class VerificationService
{
    public function __construct(
        private readonly TimeLogRepositoryInterface $timeLogRepository
    ) {}

    public function verify(TimeLog $log, User $supervisor, string $action, ?string $feedback = null): TimeLog
    {
        $this->assertSupervisorOwnsLog($log, $supervisor);

        if ($log->status !== 'pending_verification') {
            throw new UnprocessableEntityHttpException(
                'Only logs with status pending_verification can be verified or rejected.'
            );
        }

        Verification::create([
            'time_log_id' => $log->id,
            'verified_by' => $supervisor->id,
            'action' => $action,
            'feedback' => $feedback,
        ]);

        $newStatus = $action === 'verified' ? 'verified' : 'rejected';

        $updated = $this->timeLogRepository->update($log, [
            'status' => $newStatus,
            'verified_by' => $supervisor->id,
            'verified_at' => now(),
            'rejection_reason' => $action === 'rejected' ? $feedback : null,
        ]);

        AuditLog::record($action, $updated, ['status' => $log->status], ['status' => $newStatus]);

        if ($action === 'verified') {
            event(new HoursVerified($updated));
        } else {
            event(new HoursRejected($updated, $feedback));
        }

        return $updated;
    }

    private function assertSupervisorOwnsLog(TimeLog $log, User $supervisor): void
    {
        if ($log->assignment->supervisor_id !== $supervisor->id) {
            throw new AccessDeniedHttpException(
                'You are not authorized to verify logs for this student.'
            );
        }
    }
}
