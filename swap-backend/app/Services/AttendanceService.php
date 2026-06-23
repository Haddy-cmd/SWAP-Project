<?php

namespace App\Services;

use App\Events\AttendanceCompleted;
use App\Events\AttendanceStarted;
use App\Jobs\SendApplicationNotificationJob;
use App\Models\Assignment;
use App\Models\TimeLog;
use App\Models\User;
use App\Repositories\Contracts\TimeLogRepositoryInterface;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class AttendanceService
{
    /** GPS readings worse than this (meters) are treated as untrustworthy and flagged. */
    private const ACCURACY_THRESHOLD_METERS = 100;

    public function __construct(
        private readonly TimeLogRepositoryInterface $timeLogRepository,
        private readonly QrCodeService $qrCodeService,
        private readonly GeofenceService $geofenceService
    ) {}

    /**
     * Office-level geofenced clock-in: scan the shared office QR + provide GPS location.
     */
    public function timeInGeofence(User $user, string $officeToken, ?float $latitude, ?float $longitude, ?float $accuracy = null): TimeLog
    {
        $office = $this->qrCodeService->validateOffice($officeToken);

        if (!$office) {
            throw new UnprocessableEntityHttpException('Invalid or tampered office QR code.');
        }

        $assignment = Assignment::where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        if (!$assignment) {
            throw new UnprocessableEntityHttpException('You have no active assignment.');
        }

        if ($assignment->office_id !== $office->id) {
            throw new UnprocessableEntityHttpException('This QR code belongs to a different office than your assignment.');
        }

        // Geofencing is required for every office: it must have a configured location.
        if (!$office->geofence_enabled || $office->latitude === null || $office->longitude === null) {
            throw new UnprocessableEntityHttpException(
                'This office has no location configured yet. Please contact your administrator before clocking in.'
            );
        }

        if ($latitude === null || $longitude === null) {
            throw new UnprocessableEntityHttpException('Location access is required to clock in at this office.');
        }

        if (!$this->geofenceService->isWithin($office, $latitude, $longitude, $accuracy)) {
            throw new UnprocessableEntityHttpException('You must be on the office premises to clock in.');
        }

        $this->guardClockIn($assignment, $user);

        return $this->createOpenLog($assignment, $user, $latitude, $longitude, $accuracy);
    }

    public function timeOut(User $user, int $logId, string $qrToken, ?float $latitude = null, ?float $longitude = null, ?float $accuracy = null): TimeLog
    {
        $log = $this->timeLogRepository->findById($logId);

        if (!$log || $log->user_id !== $user->id || $log->status !== 'open') {
            throw new UnprocessableEntityHttpException('No open attendance log found with this ID.');
        }

        // Accept either the office QR or the assignment QR — but it must be the recipient's OWN
        // office/assignment, not just any valid code.
        $office = $this->qrCodeService->validateOffice($qrToken);
        $assignment = $office ? null : $this->qrCodeService->validate($qrToken);

        if (!$office && !$assignment) {
            throw new UnprocessableEntityHttpException('Invalid or tampered QR code.');
        }

        $matchesOwn =
            ($office && $office->id === $log->assignment->office_id)
            || ($assignment && $assignment->id === $log->assignment_id);

        if (!$matchesOwn) {
            throw new UnprocessableEntityHttpException(
                'This QR code is for a different office. Please scan your assigned office QR to clock out.'
            );
        }

        if (!$log->hasNarrative()) {
            throw new UnprocessableEntityHttpException(
                'Please submit your narrative report before clocking out.'
            );
        }

        return $this->finalizeClockOut($log, $user, 'manual', $latitude, $longitude, null, $accuracy);
    }

    /**
     * System-triggered clock-out when a recipient leaves the office geofence.
     * Does not require a narrative (they have physically left the premises).
     */
    public function autoClockOut(User $user, int $logId, ?float $latitude = null, ?float $longitude = null, ?float $accuracy = null): TimeLog
    {
        $log = $this->timeLogRepository->findById($logId);

        if (!$log || $log->user_id !== $user->id || $log->status !== 'open') {
            throw new UnprocessableEntityHttpException('No open attendance log found with this ID.');
        }

        return $this->finalizeClockOut($log, $user, 'auto', $latitude, $longitude, null, $accuracy);
    }

    public function getOpenLog(User $user): ?TimeLog
    {
        $log = $this->timeLogRepository->findOpenLogForToday($user->id);

        return $log?->load(['assignment.office', 'narrativeReport']);
    }

    public function getActiveAssignment(User $user): ?Assignment
    {
        return Assignment::with(['office', 'supervisor'])
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();
    }

    public function getHoursSummary(User $user): array
    {
        return $this->timeLogRepository->getHoursSummary($user->id);
    }

    /**
     * Grant manual ("bonus") hours to a recipient. duration_hours is computed from the span.
     *
     * @param bool $autoVerify  true (supervisor) → recorded as verified immediately;
     *                          false (admin) → left pending_verification for the supervisor to approve.
     */
    public function addManualHours(Assignment $assignment, float $hours, string $date, ?string $reason, User $recordedBy, bool $autoVerify = true): TimeLog
    {
        $timeIn = Carbon::parse($date)->setTime(8, 0, 0);
        $timeOut = (clone $timeIn)->addMinutes((int) round($hours * 60));

        $log = TimeLog::create([
            'assignment_id' => $assignment->id,
            'user_id' => $assignment->user_id,
            'date' => $timeIn->toDateString(),
            'time_in' => $timeIn,
            'time_out' => $timeOut,
            'status' => $autoVerify ? 'verified' : 'pending_verification',
            'verified_by' => $autoVerify ? $recordedBy->id : null,
            'verified_at' => $autoVerify ? now() : null,
            'clocked_out_reason' => 'manual',
            'is_manual' => true,
            'manual_reason' => $reason,
            'recorded_by' => $recordedBy->id,
        ]);

        // duration_hours is a DB-generated column — reload so it's present in the response.
        $log->refresh();

        return $log;
    }

    public function getLogsForUser(User $user, array $filters = [], int $perPage = 15): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        return $this->timeLogRepository->paginateForUser($user->id, $filters, $perPage);
    }

    private function guardClockIn(Assignment $assignment, User $user): void
    {
        if ($assignment->required_hours > 0 && $assignment->verified_hours >= $assignment->required_hours) {
            throw new ConflictHttpException('You have already completed your required service hours.');
        }

        if ($this->timeLogRepository->findOpenLogForToday($user->id)) {
            throw new ConflictHttpException('You already have an open attendance log for today.');
        }
    }

    private function createOpenLog(Assignment $assignment, User $user, ?float $lat = null, ?float $lng = null, ?float $accuracy = null): TimeLog
    {
        $log = $this->timeLogRepository->create([
            'assignment_id' => $assignment->id,
            'user_id' => $user->id,
            'date' => Carbon::today()->toDateString(),
            'time_in' => now(),
            'time_in_lat' => $lat,
            'time_in_lng' => $lng,
            'time_in_accuracy' => $accuracy,
            // Flag clock-ins where the GPS fix is too coarse to trust the geofence check.
            'location_flagged' => $accuracy !== null && $accuracy > self::ACCURACY_THRESHOLD_METERS,
            'status' => 'open',
        ]);

        broadcast(new AttendanceStarted(
            supervisorId: $assignment->supervisor_id,
            studentName: $user->name,
            timeIn: $log->time_in->toISOString(),
        ))->toOthers();

        return $log->load(['assignment.office']);
    }

    /**
     * System safety-net: close a log left open beyond the max session length.
     * Credits time only up to the cap (time_in + maxHours), not until the cron happened to run.
     */
    public function closeStaleLog(TimeLog $log, int $maxHours): TimeLog
    {
        $user = $log->user ?? $log->loadMissing('user')->user;
        $cap = Carbon::parse($log->time_in)->addHours($maxHours);
        $timeOut = $cap->isFuture() ? now() : $cap;

        return $this->finalizeClockOut($log, $user, 'auto_stale', null, null, $timeOut);
    }

    private function finalizeClockOut(TimeLog $log, User $user, string $reason, ?float $lat, ?float $lng, ?Carbon $timeOut = null, ?float $accuracy = null): TimeLog
    {
        $assignment = $log->assignment ?? $log->loadMissing('assignment')->assignment;

        $updated = $this->timeLogRepository->update($log, [
            'time_out' => $timeOut ?? now(),
            'status' => 'pending_verification',
            'clocked_out_reason' => $reason,
            'time_out_lat' => $lat,
            'time_out_lng' => $lng,
            'time_out_accuracy' => $accuracy,
            // Keep an existing time-in flag; also flag a poor time-out fix.
            'location_flagged' => $log->location_flagged || ($accuracy !== null && $accuracy > self::ACCURACY_THRESHOLD_METERS),
        ]);

        SendApplicationNotificationJob::dispatch('supervisor_time_out', [
            'user_id' => $assignment->supervisor_id,
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
}
