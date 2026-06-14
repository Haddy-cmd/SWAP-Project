<?php

namespace App\Services;

use App\Events\ApplicationApproved;
use App\Events\ApplicationRejected;
use App\Events\ApplicationSubmitted;
use App\Events\InterviewScheduled;
use App\Models\Application;
use App\Models\AuditLog;
use App\Models\User;
use App\Repositories\Contracts\ApplicationRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class ApplicationService
{
    public function __construct(
        private readonly ApplicationRepositoryInterface $applicationRepository
    ) {}

    public function submitApplication(User $user, array $data): Application
    {
        $existing = $this->applicationRepository->findForUserAndPeriod(
            $user->id,
            $data['academic_year'],
            $data['semester']
        );

        if ($existing) {
            throw new ConflictHttpException(
                "You already have an application for {$data['academic_year']} {$data['semester']}."
            );
        }

        $application = $this->applicationRepository->create([
            'user_id' => $user->id,
            'academic_year' => $data['academic_year'],
            'semester' => $data['semester'],
            'status' => 'submitted',
        ]);

        AuditLog::record('created', $application);
        event(new ApplicationSubmitted($application));

        return $application;
    }

    public function getUserApplications(User $user): Collection
    {
        return $this->applicationRepository->findByUser($user->id);
    }

    public function getApplicationById(int $id): ?Application
    {
        return $this->applicationRepository->findById($id);
    }

    public function paginateForAdmin(array $filters = []): LengthAwarePaginator
    {
        return $this->applicationRepository->paginate($filters);
    }

    public function markUnderReview(Application $application, User $admin): Application
    {
        $old = $application->only(['status']);
        $updated = $this->applicationRepository->update($application, [
            'status' => 'under_review',
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
        ]);

        AuditLog::record('updated', $updated, $old, $updated->only(['status']));

        return $updated;
    }

    public function scheduleInterview(Application $application, array $interviewData, User $admin): Application
    {
        $old = $application->only(['status']);

        $application->interview()->updateOrCreate(
            ['application_id' => $application->id],
            $interviewData
        );

        $updated = $this->applicationRepository->update($application, [
            'status' => 'interview_scheduled',
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
        ]);

        AuditLog::record('updated', $updated, $old, $updated->only(['status']));
        event(new InterviewScheduled($updated));

        return $updated->load('interview');
    }

    public function decideApplication(Application $application, string $decision, ?string $remarks, User $admin): Application
    {
        $old = $application->only(['status', 'remarks']);

        $updated = $this->applicationRepository->update($application, [
            'status' => $decision,
            'remarks' => $remarks,
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
        ]);

        AuditLog::record('updated', $updated, $old, $updated->only(['status', 'remarks']));

        if ($decision === 'approved') {
            event(new ApplicationApproved($updated));
        } elseif ($decision === 'rejected') {
            event(new ApplicationRejected($updated));
        }

        return $updated;
    }

    public function attachDocument(Application $application, array $documentData): void
    {
        $application->documents()->create($documentData);
    }
}
