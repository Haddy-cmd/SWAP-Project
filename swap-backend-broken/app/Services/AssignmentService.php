<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\User;
use App\Repositories\Contracts\AssignmentRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class AssignmentService
{
    public function __construct(
        private readonly AssignmentRepositoryInterface $assignmentRepository,
        private readonly QrCodeService $qrCodeService
    ) {}

    public function createAssignment(array $data, User $admin): Assignment
    {
        $assignment = $this->assignmentRepository->create($data);

        $this->qrCodeService->generateForAssignment($assignment);

        $user = User::find($data['user_id']);
        if ($user && $user->isApplicant()) {
            $user->update(['role' => 'recipient']);
        }

        AuditLog::record('created', $assignment->fresh(), null, $assignment->toArray(), $admin->id);

        return $assignment->fresh(['user.profile', 'office', 'supervisor']);
    }

    public function updateAssignment(Assignment $assignment, array $data, User $admin): Assignment
    {
        $old = $assignment->toArray();
        $updated = $this->assignmentRepository->update($assignment, $data);

        AuditLog::record('updated', $updated, $old, $updated->toArray(), $admin->id);

        return $updated;
    }

    public function regenerateQr(Assignment $assignment): string
    {
        return $this->qrCodeService->regenerateSecret($assignment);
    }

    public function getAssignmentById(int $id): ?Assignment
    {
        return $this->assignmentRepository->findById($id);
    }

    public function getActiveAssignmentForUser(int $userId): ?Assignment
    {
        return $this->assignmentRepository->findActiveByUser($userId);
    }

    public function paginateAssignments(array $filters = []): LengthAwarePaginator
    {
        return $this->assignmentRepository->paginate($filters);
    }
}
