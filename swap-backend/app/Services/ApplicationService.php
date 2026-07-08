<?php

namespace App\Services;

use App\Events\ApplicationApproved;
use App\Events\ApplicationRejected;
use App\Events\ApplicationSubmitted;
use App\Events\InterviewScheduled;
use App\Models\Application;
use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\Setting;
use App\Models\User;
use App\Repositories\Contracts\ApplicationRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class ApplicationService
{
    public function __construct(
        private readonly ApplicationRepositoryInterface $applicationRepository,
        private readonly AssignmentService $assignmentService,
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
     * Semester renewal: a returning recipient re-enrolls for the term set by the
     * admin (renewal_year/semester) by submitting an updated COR. Skips the
     * interview pipeline — approval directly rolls the assignment over.
     */
    public function submitRenewal(User $user, UploadedFile $cor): Application
    {
        if (!Setting::bool('renewal_open', false)) {
            throw new UnprocessableEntityHttpException('The renewal period is not open yet. Please wait for the DSA announcement.');
        }

        $year = Setting::get('renewal_year');
        $semester = Setting::get('renewal_semester');
        if (!$year || !$semester) {
            throw new UnprocessableEntityHttpException('The renewal period is not fully configured. Please contact the DSA office.');
        }

        $previous = Assignment::where('user_id', $user->id)->orderByDesc('id')->first();
        if (!$previous) {
            throw new UnprocessableEntityHttpException('Renewal is only available to recipients with an existing assignment.');
        }

        if ($this->applicationRepository->findForUserAndPeriod($user->id, $year, $semester)) {
            throw new ConflictHttpException("You already have a submission for {$year} — {$semester}.");
        }

        $application = $this->applicationRepository->create([
            'user_id' => $user->id,
            'academic_year' => $year,
            'semester' => $semester,
            'status' => 'submitted',
            'type' => 'renewal',
        ]);

        // Store the updated COR; roll the application back if storage fails so a
        // broken upload can't leave a document-less renewal in the queue.
        $disk = config('filesystems.documents_disk', 'public');
        try {
            $path = $cor->store("documents/{$application->id}", $disk);
            if ($path === false) {
                throw new \Exception('Storage driver returned false.');
            }
        } catch (\Throwable $e) {
            $application->delete();
            Log::error('Renewal COR upload failed', ['error' => $e->getMessage()]);
            throw new UnprocessableEntityHttpException('Could not upload your COR. Please try again.');
        }

        $this->attachDocument($application, [
            'document_type' => 'cor',
            'file_path' => $path,
            'file_url' => rtrim(config('app.url'), '/') . '/api/documents/{DOC_ID}/file',
            'file_name' => $cor->getClientOriginalName(),
            'file_size' => $cor->getSize(),
            'mime_type' => $cor->getMimeType(),
        ]);

        AuditLog::record('created', $application);
        event(new ApplicationSubmitted($application));

        return $application->load('documents');
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

        // Let the applicant know their submission is being reviewed (in-app only).
        $updated->loadMissing('user')->user?->notify(new \App\Notifications\ApplicationUnderReviewNotification([
            'application_id' => $updated->id,
        ]));

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

    /**
     * Move an existing interview to a new time (and optionally venue/mode). The
     * previous schedule is kept as an audit trail entry — who moved it, from
     * when to when — and the applicant is re-notified. Also clears a no-show
     * flag, since a rescheduled interview is pending again.
     */
    public function rescheduleInterview(Application $application, array $data, User $admin): Application
    {
        $interview = $application->interview;

        if (!$interview) {
            throw new ConflictHttpException('This application has no interview to reschedule.');
        }

        if (($data['mode'] ?? null) === 'in_person' && empty($data['location'])) {
            $data['location'] = self::DSA_OFFICE_LOCATION;
        }

        $old = [
            'scheduled_at' => $interview->scheduled_at?->toISOString(),
            'location' => $interview->location,
            'mode' => $interview->mode,
            'status' => $interview->status,
        ];

        $interview->update(array_merge($data, ['status' => 'scheduled']));
        $interview->refresh();

        AuditLog::record('rescheduled', $interview, $old, [
            'scheduled_at' => $interview->scheduled_at?->toISOString(),
            'location' => $interview->location,
            'mode' => $interview->mode,
            'status' => $interview->status,
        ], $admin->id);

        $updated = $this->applicationRepository->update($application, [
            'status' => 'interview_scheduled',
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
        ]);

        event(new InterviewScheduled($updated));

        return $updated->load('interview');
    }

    /** Record that the applicant did not attend their scheduled interview. */
    public function markInterviewNoShow(Application $application, User $admin): Application
    {
        $interview = $application->interview;

        if (!$interview) {
            throw new ConflictHttpException('This application has no interview.');
        }

        if ($interview->status !== 'scheduled') {
            throw new ConflictHttpException('Only a scheduled interview can be marked as a no-show.');
        }

        $interview->update(['status' => 'no_show']);
        AuditLog::record('updated', $interview, ['status' => 'scheduled'], ['status' => 'no_show'], $admin->id);

        return $application->fresh('interview');
    }

    public function decideApplication(Application $application, string $decision, ?string $remarks, User $admin): Application
    {
        // A fresh application can only be approved once its interview has been
        // scheduled. Renewals skip the interview — the recipient already went
        // through it and has a service record instead. Rejection is allowed anytime.
        if ($decision === 'approved' && $application->type !== 'renewal' && $application->status !== 'interview_scheduled') {
            throw new ConflictHttpException(
                'An interview must be scheduled before this application can be approved.'
            );
        }

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

            // Approving a renewal immediately rolls the assignment into the new
            // term — same office and supervisor, hours reset.
            if ($updated->type === 'renewal') {
                $this->rolloverRenewal($updated, $admin);
            }
        } elseif ($decision === 'rejected') {
            event(new ApplicationRejected($updated));
        }

        return $updated;
    }

    /** Create the next-term assignment for an approved renewal. */
    private function rolloverRenewal(Application $application, User $admin): void
    {
        $previous = Assignment::where('user_id', $application->user_id)
            ->where(fn ($q) => $q->where('academic_year', '!=', $application->academic_year)
                ->orWhere('semester', '!=', $application->semester))
            ->orderByDesc('id')
            ->first();

        if (!$previous) {
            return;
        }

        $alreadyPlaced = Assignment::where('user_id', $application->user_id)
            ->where('academic_year', $application->academic_year)
            ->where('semester', $application->semester)
            ->exists();

        if ($alreadyPlaced) {
            return;
        }

        // Close out the old term so the recipient has exactly one active assignment.
        if ($previous->status === 'active') {
            $previous->update(['status' => 'completed']);
        }

        $this->assignmentService->createAssignment([
            'user_id' => $application->user_id,
            'office_id' => $previous->office_id,
            'supervisor_id' => $previous->supervisor_id,
            'academic_year' => $application->academic_year,
            'semester' => $application->semester,
            'required_hours' => $previous->required_hours,
            'start_date' => now()->toDateString(),
        ], $admin);
    }

    public function attachDocument(Application $application, array $documentData): void
    {
        $application->documents()->create($documentData);
    }
}
