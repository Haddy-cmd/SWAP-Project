<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\OfficeAssignmentNotification;
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

        $fresh = $assignment->fresh(['user.profile', 'office', 'supervisor']);

        // Tell the recipient where they've been placed and who supervises them.
        $fresh->user?->notify(new OfficeAssignmentNotification([
            'office' => $fresh->office?->name,
            'location' => $fresh->office?->location,
            'supervisor' => $fresh->supervisor?->name,
            'assignment_id' => $fresh->id,
            'changed' => false,
        ]));

        return $fresh;
    }

    public function updateAssignment(Assignment $assignment, array $data, User $admin): Assignment
    {
        $old = $assignment->toArray();

        // Detect a move BEFORE persisting, so we can notify only on real changes.
        $officeChanged = array_key_exists('office_id', $data)
            && (int) $data['office_id'] !== (int) $assignment->office_id;
        $supervisorChanged = array_key_exists('supervisor_id', $data)
            && (int) $data['supervisor_id'] !== (int) $assignment->supervisor_id;

        $updated = $this->assignmentRepository->update($assignment, $data);

        AuditLog::record('updated', $updated, $old, $updated->toArray(), $admin->id);

        if ($officeChanged || $supervisorChanged) {
            $updated->loadMissing(['user', 'office', 'supervisor']);
            $updated->user?->notify(new OfficeAssignmentNotification([
                'office' => $updated->office?->name,
                'location' => $updated->office?->location,
                'supervisor' => $updated->supervisor?->name,
                'assignment_id' => $updated->id,
                'changed' => true,
            ]));
        }

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
