<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\Office;
use App\Models\User;
use App\Notifications\OfficeAssignmentNotification;
use App\Repositories\Contracts\AssignmentRepositoryInterface;
use App\Support\AfterCommit;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class AssignmentService
{
    /** Shared with StoreAssignmentRequest so the validator and the DB backstop agree. */
    public const MSG_ALREADY_ASSIGNED = 'This recipient already has an active assignment for this term.';

    /** A new placement or a move into an office already at its limit (renewals keep their seat). */
    public const MSG_OFFICE_FULL = '%s is full (%d of %d). Raise its limit on the Offices page or pick another office.';

    public function __construct(
        private readonly AssignmentRepositoryInterface $assignmentRepository,
        private readonly QrCodeService $qrCodeService
    ) {}

    public function createAssignment(array $data, User $admin, bool $enforceCapacity = true): Assignment
    {
        // Assignment, QR secret and role promotion land together or not at all; the
        // unique active-per-term index turns a double-submit into a clean 422.
        try {
            $assignment = DB::transaction(function () use ($data, $admin, $enforceCapacity) {
                if ($enforceCapacity) {
                    // Renewals complete the previous term first, so only new placements check this.
                    if ($elsewhere = self::activeElsewhereMessage((int) $data['user_id'])) {
                        throw ValidationException::withMessages(['user_id' => $elsewhere]);
                    }
                    $this->assertReady((int) $data['office_id']);
                    $this->assertRoom((int) $data['office_id']);
                }

                $assignment = $this->assignmentRepository->create($data);

                $this->qrCodeService->generateForAssignment($assignment);

                // Approval already makes the student a recipient; this covers anyone
                // approved before that rule (2026-10-05) and not migrated yet.
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

        // A "move" to the office they're already in (with no supervisor change) is not a move.
        if (array_key_exists('office_id', $data) && !$officeChanged && !$supervisorChanged) {
            $assignment->loadMissing(['user', 'office']);
            throw ValidationException::withMessages(['office_id' => sprintf(self::MSG_SAME_OFFICE,
                $assignment->user?->name ?? 'This student', $assignment->office?->name ?? 'that office')]);
        }

        // Reactivating an old placement while another one is active would give the student two.
        if (($data['status'] ?? null) === 'active' && $assignment->status !== 'active'
            && ($elsewhere = self::activeElsewhereMessage($assignment->user_id, $assignment->id))) {
            throw ValidationException::withMessages(['status' => $elsewhere]);
        }

        $updated = DB::transaction(function () use ($assignment, $data, $admin, $old, $officeChanged) {
            // Moving into another office needs a free seat there; a supervisor-only change never does.
            if ($officeChanged) {
                $this->assertReady((int) $data['office_id']);
                $this->assertRoom((int) $data['office_id'], $assignment->id);
            }

            $updated = $this->assignmentRepository->update($assignment, $data);
            AuditLog::record('updated', $updated, $old, $updated->toArray(), $admin->id);

            return $updated;
        });

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

    /**
     * Refuses (422 on office_id) when the office's active placements already reach its limit.
     * The office row is locked so two admins can't both take its last seat.
     */
    public const MSG_SAME_OFFICE = '%s is already placed at %s. Pick a different office.';

    public const MSG_ACTIVE_ELSEWHERE = '%s is already placed at %s for %s %s. Move them with Edit on that placement, or complete that term first.';

    /** A student has at most one active placement across all terms; null when they have none (besides $ignoreId). */
    public static function activeElsewhereMessage(int $userId, ?int $ignoreId = null): ?string
    {
        $other = Assignment::with(['user', 'office'])->where('user_id', $userId)->current()
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))->first();

        return $other ? sprintf(self::MSG_ACTIVE_ELSEWHERE, $other->user?->name ?? 'This student',
            $other->office?->name ?? 'an office', $other->semester, $other->academic_year) : null;
    }

    public const MSG_OFFICE_CLOSED = '%s is closed to new placements. Open it on the Offices page or pick another office.';
    public const MSG_OFFICE_NOT_READY = "%s isn't set up yet (needs: %s). Finish it on the Offices page or pick another office.";

    /** New placements and moves need an open, fully set-up office (renewals keep their seat). */
    private function assertReady(int $officeId): void
    {
        $office = Office::find($officeId);
        if (!$office) {
            return;
        }
        if (!$office->is_active) {
            throw ValidationException::withMessages(['office_id' => sprintf(self::MSG_OFFICE_CLOSED, $office->name)]);
        }
        $labels = ['supervisor' => 'supervisor', 'location' => 'map location', 'clock_in_area' => 'clock-in area'];
        if ($missing = $office->missingSetup()) {
            throw ValidationException::withMessages(['office_id' => sprintf(self::MSG_OFFICE_NOT_READY, $office->name,
                implode(', ', array_map(fn ($m) => $labels[$m], $missing)))]);
        }
    }

    private function assertRoom(int $officeId, ?int $ignoreAssignmentId = null): void
    {
        $office = Office::lockForUpdate()->find($officeId);
        if (!$office) {
            return; // the request's `exists` rule answers this one
        }

        $taken = $office->activeAssignments()
            ->when($ignoreAssignmentId, fn ($q) => $q->where('id', '!=', $ignoreAssignmentId))
            ->count();

        if ($taken >= (int) $office->max_recipients) {
            throw ValidationException::withMessages([
                'office_id' => sprintf(self::MSG_OFFICE_FULL, $office->name, $taken, (int) $office->max_recipients),
            ]);
        }
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
