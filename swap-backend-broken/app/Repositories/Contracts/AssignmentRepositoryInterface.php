<?php

namespace App\Repositories\Contracts;

use App\Models\Assignment;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface AssignmentRepositoryInterface
{
    public function findById(int $id): ?Assignment;

    public function findByUser(int $userId): ?Assignment;

    public function findActiveByUser(int $userId): ?Assignment;

    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator;

    public function create(array $data): Assignment;

    public function update(Assignment $assignment, array $data): Assignment;

    public function regenerateQrSecret(Assignment $assignment): Assignment;
}
