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
        // Once an application is approved, the applicant is in the pipeline waiting for
        // an office assignment and may not submit further applications.
        if ($this->applicationRepository->findByUser($user->id)->contains('status', 'approved')) {
            throw new ConflictHttpException(
                'Your application has already been approved. Please wait for the office assignment announcement.'
            );
        }

        // An applicant with an application still in progress (submitted, under review, or
        // scheduled for interview) may not submit another until it is decided.
        $inProgress = $this->applicationRepository->findByUser($user->id)
            ->whereIn('status', ['submitted', 'under_review', 'interview_scheduled'])
            ->first();

        if ($inProgress) {
            throw new ConflictHttpException(
                'You already have an application in progress. Please wait for it to be reviewed before submitting another.'
            );
        }

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

    /**
     * Hard-delete a freshly-submitted application. Used to roll back a submission
     * when its document uploads fail, so it doesn't linger "in review" with no
     * documents and block the applicant from re-submitting. Documents cascade.
     */
    public function deleteApplication(Application $application): void
    {
        AuditLog::record('deleted', $application);
        $application->delete();
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

    /** Default venue for in-person interviews. */
    public const DSA_OFFICE_LOCATION = 'Office of the Dean of Students Affairs (DSA)';

    public function scheduleInterview(Application $application, array $interviewData, User $admin): Application
    {
        $old = $application->only(['status']);

        // In-person interviews are always held at the DSA office, so the applicant must
        // know the venue. Fall back to the DSA office when no specific location is given.
        if (($interviewData['mode'] ?? null) === 'in_person' && empty($interviewData['location'])) {
            $interviewData['location'] = self::DSA_OFFICE_LOCATION;
        }

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
