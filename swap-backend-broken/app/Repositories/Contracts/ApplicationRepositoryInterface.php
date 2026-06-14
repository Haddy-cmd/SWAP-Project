<?php

namespace App\Repositories\Contracts;

use App\Models\Application;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

interface ApplicationRepositoryInterface
{
    public function findById(int $id): ?Application;

    public function findByUser(int $userId): Collection;

    public function findForUserAndPeriod(int $userId, string $academicYear, string $semester): ?Application;

    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator;

    public function create(array $data): Application;

    public function update(Application $application, array $data): Application;

    public function countByStatus(string $academicYear, string $semester): array;
}
