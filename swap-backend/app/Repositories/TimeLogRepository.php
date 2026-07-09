<?php

namespace App\Repositories;

use App\Models\Assignment;
use App\Models\TimeLog;
use App\Models\User;
use App\Repositories\Contracts\TimeLogRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;

class TimeLogRepository implements TimeLogRepositoryInterface
{
    /**
     * whereHas('assignment') clause for a supervisor's reach — their own
     * assignments plus their office's (co-supervisors share students).
     */
    private function assignmentClauseFor(int $supervisorId): \Closure
    {
        $supervisor = User::find($supervisorId);

        return function ($q) use ($supervisor, $supervisorId) {
            if ($supervisor) {
                $q->visibleToSupervisor($supervisor);
            } else {
                $q->where('supervisor_id', $supervisorId);
            }
        };
    }

    public function findById(int $id): ?TimeLog
    {
        return TimeLog::with(['assignment.office', 'narrativeReport', 'verifications.verifier'])
            ->find($id);
    }

    public function findOpenLogForToday(int $userId): ?TimeLog
    {
        return TimeLog::where('user_id', $userId)
            ->where('date', Carbon::today()->toDateString())
            ->where('status', 'open')
            ->first();
    }

    /** Any open (not-yet-clocked-out) log for the user, regardless of date. */
    public function findAnyOpenLog(int $userId): ?TimeLog
    {
        return TimeLog::where('user_id', $userId)
            ->where('status', 'open')
            ->orderByDesc('time_in')
            ->first();
    }

    public function findByAssignment(int $assignmentId, array $filters = []): Collection
    {
        $query = TimeLog::with(['narrativeReport', 'verifications.verifier'])
            ->where('assignment_id', $assignmentId)
            ->orderByDesc('date');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['from'])) {
            $query->where('date', '>=', $filters['from']);
        }

        if (!empty($filters['to'])) {
            $query->where('date', '<=', $filters['to']);
        }

        return $query->get();
    }

    public function paginateForSupervisor(int $supervisorId, array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        // verifier: offices with co-supervisors share a roster, so a reviewed log must
        // name who acted on it — otherwise the other supervisor can't tell whether it
        // still needs them, and the two duplicate each other's work.
        $query = TimeLog::with(['user.profile', 'assignment.office', 'narrativeReport', 'verifier.profile'])
            ->whereHas('assignment', $this->assignmentClauseFor($supervisorId))
            ->orderByDesc('date');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['status_in'])) {
            $query->whereIn('status', $filters['status_in']);
        }

        if (!empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        return $query->paginate($perPage);
    }

    public function paginateForUser(int $userId, array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = TimeLog::with(['assignment.office', 'narrativeReport', 'verifications.verifier'])
            ->where('user_id', $userId)
            ->orderByDesc('date')
            ->orderByDesc('time_in');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return $query->paginate($perPage);
    }

    public function create(array $data): TimeLog
    {
        return TimeLog::create($data);
    }

    public function update(TimeLog $log, array $data): TimeLog
    {
        $log->update($data);

        return $log->fresh(['assignment.office', 'narrativeReport', 'verifications']);
    }

    public function getHoursSummary(int $userId): array
    {
        $assignment = Assignment::where('user_id', $userId)
            ->where('status', 'active')
            ->first();

        if (!$assignment) {
            return [
                'required' => 0,
                'rendered' => 0,
                'verified' => 0,
                'pending' => 0,
                'rejected' => 0,
                'remaining' => 0,
            ];
        }

        $logs = TimeLog::where('user_id', $userId)
            ->where('assignment_id', $assignment->id)
            ->whereNotNull('duration_hours')
            ->get();

        $verified = $logs->where('status', 'verified')->sum('duration_hours');
        $pending = $logs->where('status', 'pending_verification')->sum('duration_hours');
        $rejected = $logs->where('status', 'rejected')->sum('duration_hours');
        $rendered = $logs->whereIn('status', ['verified', 'pending_verification', 'rejected'])->sum('duration_hours');

        return [
            'required' => (float) $assignment->required_hours,
            'rendered' => (float) $rendered,
            'verified' => (float) $verified,
            'pending' => (float) $pending,
            'rejected' => (float) $rejected,
            'remaining' => max(0, (float) $assignment->required_hours - (float) $verified),
        ];
    }

    public function getPendingVerificationsCount(int $supervisorId): int
    {
        return TimeLog::whereHas('assignment', $this->assignmentClauseFor($supervisorId))
            ->where('status', 'pending_verification')
            ->count();
    }

    public function getVerifiedThisWeekCount(int $supervisorId): int
    {
        return TimeLog::whereHas('assignment', $this->assignmentClauseFor($supervisorId))
            ->where('status', 'verified')
            ->where('verified_at', '>=', Carbon::now()->startOfWeek())
            ->count();
    }
}
