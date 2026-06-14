<?php

namespace App\Services;

use App\Events\AttendanceCompleted;
use App\Events\AttendanceStarted;
use App\Jobs\SendApplicationNotificationJob;
use App\Models\TimeLog;
use App\Models\User;
use App\Repositories\Contracts\TimeLogRepositoryInterface;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class AttendanceService
{
    public function __construct(
        private readonly TimeLogRepositoryInterface $timeLogRepository,
        private readonly QrCodeService $qrCodeService
    ) {}

    public function timeIn(User $user, string $qrToken): TimeLog
    {
        $assignment = $this->qrCodeService->validate($qrToken);

        if (!$assignment) {
            throw new UnprocessableEntityHttpException('Invalid or tampered QR code.');
        }

        if ($assignment->user_id !== $user->id) {
            throw new UnprocessableEntityHttpException('This QR code does not belong to your assignment.');
        }

        $existingOpenLog = $this->timeLogRepository->findOpenLogForToday($user->id);
        if ($existingOpenLog) {
            throw new ConflictHttpException('You already have an open attendance log for today.');
        }

        $log = $this->timeLogRepository->create([
            'assignment_id' => $assignment->id,
            'user_id' => $user->id,
            'date' => Carbon::today()->toDateString(),
            'time_in' => now(),
            'status' => 'open',
        ]);

        broadcast(new AttendanceStarted(
            supervisorId: $assignment->supervisor_id,
            studentName: $user->name,
            timeIn: $log->time_in->toISOString(),
        ))->toOthers();

        return $log->load(['assignment.office']);
    }

    public function timeOut(User $user, int $logId, string $qrToken): TimeLog
    {
        $assignment = $this->qrCodeService->validate($qrToken);

        if (!$assignment) {
            throw new UnprocessableEntityHttpException('Invalid or tampered QR code.');
        }

        $log = $this->timeLogRepository->findById($logId);

        if (!$log || $log->user_id !== $user->id || $log->status !== 'open') {
            throw new UnprocessableEntityHttpException('No open attendance log found with this ID.');
        }

        if (!$log->hasNarrative()) {
            throw new UnprocessableEntityHttpException(
                'Please submit your narrative report before clocking out.'
            );
        }

        $updated = $this->timeLogRepository->update($log, [
            'time_out' => now(),
            'status' => 'pending_verification',
        ]);

        SendApplicationNotificationJob::dispatch('supervisor_time_out', [
            'supervisor_id' => $assignment->supervisor_id,
            'log_id' => $updated->id,
            'student_name' => $user->name,
            'duration_hours' => $updated->duration_hours,
        ])->onQueue('notifications');

        broadcast(new AttendanceCompleted(
            supervisorId: $assignment->supervisor_id,
            studentName: $user->name,
            durationHours: (float) $updated->duration_hours,
            logId: $updated->id,
        ))->toOthers();

        return $updated;
    }

    public function getHoursSummary(User $user): array
    {
        return $this->timeLogRepository->getHoursSummary($user->id);
    }
}
