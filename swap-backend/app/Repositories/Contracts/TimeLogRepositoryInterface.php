<?php

namespace App\Repositories\Contracts;

use App\Models\TimeLog;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

interface TimeLogRepositoryInterface
{
    public function findById(int $id): ?TimeLog;

    public function findOpenLogForToday(int $userId): ?TimeLog;

    public function findAnyOpenLog(int $userId): ?TimeLog;

    public function findByAssignment(int $assignmentId, array $filters = []): Collection;

    public function paginateForSupervisor(int $supervisorId, array $filters = [], int $perPage = 15): LengthAwarePaginator;

    public function paginateForUser(int $userId, array $filters = [], int $perPage = 15): LengthAwarePaginator;

    public function create(array $data): TimeLog;

    public function update(TimeLog $log, array $data): TimeLog;

    public function getHoursSummary(int $userId): array;

    public function getPendingVerificationsCount(int $supervisorId): int;

    public function getVerifiedThisWeekCount(int $supervisorId): int;
}
