<?php

namespace App\Repositories;

use App\Models\Assignment;
use App\Repositories\Contracts\AssignmentRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;

class AssignmentRepository implements AssignmentRepositoryInterface
{
    public function findById(int $id): ?Assignment
    {
        return Assignment::with(['user.profile', 'office', 'supervisor'])->find($id);
    }

    public function findByUser(int $userId): ?Assignment
    {
        return Assignment::with(['office', 'supervisor'])
            ->where('user_id', $userId)
            ->latest()
            ->first();
    }

    public function findActiveByUser(int $userId): ?Assignment
    {
        return Assignment::with(['office', 'supervisor'])
            ->where('user_id', $userId)
            ->where('status', 'active')
            ->first();
    }

    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        // Hour sums and the office's supervisors (for the selfie rule) are loaded
        // once for the page instead of ~4 queries per row in AssignmentResource.
        $query = Assignment::with(['user.profile', 'office.supervisors', 'supervisor'])
            ->withSum(['timeLogs as rendered_sum' => fn ($q) => $q->whereNotNull('time_out')], 'duration_hours')
            ->withSum(['timeLogs as verified_sum' => fn ($q) => $q->where('status', 'verified')], 'duration_hours')
            ->withSum(['timeLogs as pending_sum' => fn ($q) => $q->where('status', 'pending_verification')], 'duration_hours')
            ->orderByDesc('created_at');

        if (!empty($filters['office_id'])) {
            $query->where('office_id', $filters['office_id']);
        }

        if (!empty($filters['supervisor_id'])) {
            $query->where('supervisor_id', $filters['supervisor_id']);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['academic_year'])) {
            $query->where('academic_year', $filters['academic_year']);
        }

        return $query->paginate($perPage);
    }

    public function create(array $data): Assignment
    {
        return Assignment::create($data);
    }

    public function update(Assignment $assignment, array $data): Assignment
    {
        $assignment->update($data);

        return $assignment->fresh(['user.profile', 'office', 'supervisor']);
    }

    public function regenerateQrSecret(Assignment $assignment): Assignment
    {
        $assignment->update(['qr_secret' => Str::random(64)]);

        return $assignment->fresh();
    }
}
