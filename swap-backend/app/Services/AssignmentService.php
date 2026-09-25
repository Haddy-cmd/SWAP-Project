<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\OfficeAssignmentNotification;
use App\Repositories\Contracts\AssignmentRepositoryInterface;
use App\Support\AfterCommit;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class AssignmentService
{
    /** Shared with StoreAssignmentRequest so the validator and the DB backstop agree. */
    public const MSG_ALREADY_ASSIGNED = 'This recipient already has an active assignment for this term.';

    public function __construct(
        private readonly AssignmentRepositoryInterface $assignmentRepository,
        private readonly QrCodeService $qrCodeService
    ) {}

    public function createAssignment(array $data, User $admin): Assignment
    {
        // Assignment, QR secret and role promotion land together or not at all; the
        // unique active-per-term index turns a double-submit into a clean 422.
        try {
            $assignment = DB::transaction(function () use ($data, $admin) {
                $assignment = $this->assignmentRepository->create($data);

                $this->qrCodeService->generateForAssignment($assignment);

                $user = User::find($data['user_id']);
                if ($user && $user->isApplicant()) {
                    $user->update(['role' => 'recipient']);
                }

                AuditLog::record('created', $assignment->fresh(), null, $assignment->toArray(), $admin->id);

                return $assignment;
            });
        } catch (UniqueConstraintViolationException) {
            throw new UnprocessableEntityHttpException(self::MSG_ALREADY_ASSIGNED);
        }

        $fresh = $assignment->fresh(['user.profile', 'office', 'supervisor']);

        // Tell the recipient where they've been placed and who supervises them.
        AfterCommit::quietly(fn () => $fresh->user?->notify(new OfficeAssignmentNotification([
            'office' => $fresh->office?->name,
            'location' => $fresh->office?->location,
            'supervisor' => $fresh->supervisor?->name,
            'assignment_id' => $fresh->id,
            'changed' => false,
        ])), 'Office assignment notification', ['assignment_id' => $fresh->id]);

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
            AfterCommit::quietly(fn () => $updated->user?->notify(new OfficeAssignmentNotification([
                'office' => $updated->office?->name,
                'location' => $updated->office?->location,
                'supervisor' => $updated->supervisor?->name,
                'assignment_id' => $updated->id,
                'changed' => true,
            ])), 'Office reassignment notification', ['assignment_id' => $updated->id]);
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
