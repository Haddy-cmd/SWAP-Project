<?php

namespace App\Services;

use App\Events\ApplicationApproved;
use App\Events\ApplicationRejected;
use App\Events\ApplicationSubmitted;
use App\Events\InterviewScheduled;
use App\Models\Application;
use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\User;
use App\Repositories\Contracts\ApplicationRepositoryInterface;
use App\Support\AfterCommit;
use App\Support\ApplicationTransitions;
use Illuminate\Support\Facades\DB;
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
        private readonly RenewalReadinessService $renewalReadiness,
    ) {}

    public const MSG_NO_TERM = 'Applications open once the DSA sets up the current semester. Please check back later.';

    public static function msgAfterRenewal(string $term): string
    {
        return "Your renewal for {$term} was not approved. You can apply again as a new applicant next semester.";
    }

    /**
     * After a rejected renewal for a term, a new application waits for a later semester (the
     * same rule as a rejected new application). Null = no such wait. Shown to the applicant
     * before they open the form (Applicant ApplicationController::index meta.apply_block).
     */
    public function renewalWaitBlock(User $user): ?string
    {
        $latest = $this->applicationRepository->findByUser($user->id)->first();
        if (!$latest || $latest->type !== 'renewal' || $latest->status !== 'rejected') {
            return null;
        }

        $periods = app(SemesterPeriodService::class);
        $target = $periods->applicationTerm();
        $renewalTerm = $periods->forTerm($latest->academic_year, $latest->semester);
        $later = $target && ($renewalTerm
            ? $target->start_date->gt($renewalTerm->start_date)
            : !($target->academic_year === $latest->academic_year && $target->semester === $latest->semester));

        return $later ? null : self::msgAfterRenewal("{$latest->semester} {$latest->academic_year}");
    }

    /** A new application, always for the current semester (SemesterPeriodService::applicationTerm). */
    public function submitApplication(User $user): Application
    {
        $term = app(SemesterPeriodService::class)->applicationTerm();
        if (!$term) {
            throw new UnprocessableEntityHttpException(self::MSG_NO_TERM);
        }
        $data = ['academic_year' => $term->academic_year, 'semester' => $term->semester];

        // Once an application is approved, the applicant is in the pipeline waiting for
        // an office assignment and may not submit further applications. Only the latest
        // counts: a former recipient whose renewal was rejected still has the approved
        // application that first placed them, and may apply again.
        $latest = $this->applicationRepository->findByUser($user->id)->first();
        if ($latest && $latest->status === 'approved' && $latest->type !== 'renewal') {
            throw new ConflictHttpException(
                'Your application has already been approved. Please wait for the office assignment announcement.'
            );
        }

        if ($wait = $this->renewalWaitBlock($user)) {
            throw new ConflictHttpException($wait);
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
        AfterCommit::quietly(fn () => event(new ApplicationSubmitted($application)), 'Application submitted notification', ['application_id' => $application->id]);

        return $application;
    }

    /**
     * Semester renewal: a returning recipient re-enrolls for the term set by the
     * admin (renewal_year/semester) by submitting an updated COR. Skips the
     * interview pipeline — approval directly rolls the assignment over.
     */
    public function submitRenewal(User $user, UploadedFile $cor): Application
    {
        // Renewal is open for one semester period at a time (Admin → Semesters).
        $target = SemesterPeriodService::renewalTarget();
        if (!$target) {
            throw new UnprocessableEntityHttpException('The renewal period is not open yet. Please wait for the DSA announcement.');
        }
        $year = $target->academic_year;
        $semester = $target->semester;

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
        AfterCommit::quietly(fn () => event(new ApplicationSubmitted($application)), 'Application submitted notification', ['application_id' => $application->id]);

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

    public function paginateForAdmin(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        return $this->applicationRepository->paginate($filters, $perPage);
    }

    public function markUnderReview(Application $application, User $admin): Application
    {
        ApplicationTransitions::assertCanMarkUnderReview($application);

        $old = $application->only(['status']);
        $updated = $this->applicationRepository->update($application, [
            'status' => 'under_review',
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
        ]);

        AuditLog::record('updated', $updated, $old, $updated->only(['status']));

        // Let the applicant know their submission is being reviewed (in-app only).
        AfterCommit::quietly(fn () => $updated->loadMissing('user')->user?->notify(new \App\Notifications\ApplicationUnderReviewNotification([
            'application_id' => $updated->id,
        ])), 'Under-review notification', ['application_id' => $updated->id]);

        return $updated;
    }

    /** Default venue for in-person interviews. */
    public const DSA_OFFICE_LOCATION = 'Division of Student Affairs (DSA)';

    public function scheduleInterview(Application $application, array $interviewData, User $admin): Application
    {
        ApplicationTransitions::assertCanScheduleInterview($application);

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
        AfterCommit::quietly(fn () => event(new InterviewScheduled($updated)), 'Interview scheduled notification', ['application_id' => $updated->id]);

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
        ApplicationTransitions::assertOpen($application);

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

        AfterCommit::quietly(fn () => event(new InterviewScheduled($updated)), 'Interview rescheduled notification', ['application_id' => $updated->id]);

        return $updated->load('interview');
    }

    /** Record that the applicant did not attend their scheduled interview. */
    public function markInterviewNoShow(Application $application, User $admin): Application
    {
        ApplicationTransitions::assertOpen($application);

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

    public function decideApplication(Application $application, string $decision, ?string $remarks, User $admin, ?string $rejectionReason = null): Application
    {
        // A fresh application can only be approved once its interview was held
        // (scheduled, not a no-show). Renewals skip the interview — the recipient
        // already went through it and has a service record instead. Rejection is
        // allowed at any open stage; a decided application is final.
        ApplicationTransitions::assertCanDecide($application, $decision);

        // Approving a renewal waits for the renewed term: paid or covered by a note,
        // report in, and when the hours were met the report accepted as eligible (RenewalReadinessService).
        if ($decision === 'approved' && $application->type === 'renewal') {
            $this->renewalReadiness->assertReady($application);
        }

        // The status, the promotion to recipient / renewal rollover / return to the
        // applicant portal, and the audit entries land together or not at all.
        return DB::transaction(function () use ($application, $decision, $remarks, $admin, $rejectionReason) {
            $old = $application->only(['status', 'remarks', 'rejection_reason']);

            $updated = $this->applicationRepository->update($application, [
                'status' => $decision,
                'remarks' => $remarks,
                'rejection_reason' => $decision === 'rejected' ? $rejectionReason : null,
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
            ]);

            AuditLog::record('updated', $updated, $old, $updated->only(['status', 'remarks', 'rejection_reason']));

            if ($decision === 'approved') {
                // Approving a renewal immediately rolls the assignment into the new
                // term — same office and supervisor, hours reset. Done before the
                // announcement, so the renewal email can name the new placement.
                if ($updated->type === 'renewal') {
                    $this->rolloverRenewal($updated, $admin);
                } else {
                    $this->promoteToRecipient($updated, $admin);
                }

                DB::afterCommit(fn () => AfterCommit::quietly(fn () => event(new ApplicationApproved($updated)), 'Application approved notification', ['application_id' => $updated->id]));
            } elseif ($decision === 'rejected') {
                if ($updated->type === 'renewal') {
                    $this->returnToApplicant($updated, $admin);
                }

                DB::afterCommit(fn () => AfterCommit::quietly(fn () => event(new ApplicationRejected($updated)), 'Application rejected notification', ['application_id' => $updated->id]));
            }

            return $updated;
        });
    }

    public const MSG_REOPEN_NOT_REJECTED = 'Only a rejected application can be reopened.';
    public const MSG_REOPEN_RENEWAL = 'A rejected renewal cannot be reopened. The student can apply again as a new applicant next semester.';
    public const MSG_REOPEN_PAST_TERM = 'Only an application for the current semester can be reopened.';
    public const MSG_REOPEN_OTHER_APPLICATION = 'This applicant already has another application in progress or approved.';
    public const MSG_REOPEN_PURGED = "This applicant's documents were already removed, so the application cannot be reopened.";

    /**
     * Undo a rejection made by mistake: the application goes back to the step it was
     * rejected at (an interview stays scheduled), so the DSA can review it again. Only
     * for a new application in the current application term, while no other one is open
     * or approved, and before its documents were removed. Audit-logged with the reason.
     */
    public function reopenApplication(Application $application, string $reason, User $admin): Application
    {
        if ($application->status !== 'rejected') {
            throw new ConflictHttpException(self::MSG_REOPEN_NOT_REJECTED);
        }
        if ($application->type === 'renewal') {
            throw new ConflictHttpException(self::MSG_REOPEN_RENEWAL);
        }

        $term = app(SemesterPeriodService::class)->applicationTerm();
        if (!$term || $term->academic_year !== $application->academic_year || $term->semester !== $application->semester) {
            throw new ConflictHttpException(self::MSG_REOPEN_PAST_TERM);
        }

        $other = Application::where('user_id', $application->user_id)
            ->where('id', '!=', $application->id)
            ->where(fn ($q) => $q->whereIn('status', ['submitted', 'under_review', 'interview_scheduled'])
                ->orWhere(fn ($q) => $q->where('status', 'approved')->where('type', '!=', 'renewal')
                    ->where('academic_year', $application->academic_year)->where('semester', $application->semester)))
            ->exists();
        if ($other) {
            throw new ConflictHttpException(self::MSG_REOPEN_OTHER_APPLICATION);
        }

        if ($application->documents()->whereNotNull('purged_at')->exists()) {
            throw new ConflictHttpException(self::MSG_REOPEN_PURGED);
        }

        // The step it was rejected at, from the audit trail; a plain submission goes to review.
        $before = AuditLog::where('auditable_type', Application::class)
            ->where('auditable_id', $application->id)
            ->where('action', 'updated')
            ->orderByDesc('id')
            ->get(['old_values', 'new_values'])
            ->first(fn ($log) => ($log->new_values['status'] ?? null) === 'rejected')
            ?->old_values['status'] ?? null;
        $restored = in_array($before, ['under_review', 'interview_scheduled'], true) ? $before : 'under_review';
        if ($restored === 'interview_scheduled' && !$application->interview) {
            $restored = 'under_review';
        }

        return DB::transaction(function () use ($application, $reason, $admin, $restored) {
            $old = $application->only(['status', 'remarks', 'rejection_reason']);

            $updated = $this->applicationRepository->update($application, [
                'status' => $restored,
                'remarks' => null,
                'rejection_reason' => null,
                'reviewed_by' => null,
                'reviewed_at' => null,
            ]);

            // 'updated' feeds the applicant's timeline; 'reopened' keeps the why.
            AuditLog::record('updated', $updated, $old, $updated->only(['status', 'remarks', 'rejection_reason']), $admin->id);
            AuditLog::record('application_reopened', $updated, ['status' => 'rejected'], ['status' => $restored, 'reason' => $reason], $admin->id);

            DB::afterCommit(fn () => AfterCommit::quietly(fn () => $updated->loadMissing('user')->user?->notify(
                new \App\Notifications\ApplicationReopenedNotification([
                    'application_id' => $updated->id,
                    'term' => "{$updated->semester} {$updated->academic_year}",
                ])
            ), 'Application reopened notification', ['application_id' => $updated->id]));

            return $updated;
        });
    }

    /**
     * An approved application makes the student a recipient right away (since 2026-10-05),
     * before any office assignment, so DSA announcements reach them while they wait to be
     * placed. The Assignments queue still lists them (it goes by the approved application).
     */
    private function promoteToRecipient(Application $application, User $admin): void
    {
        $user = User::find($application->user_id);
        if (!$user || !$user->isApplicant()) {
            return;
        }

        $user->update(['role' => 'recipient']);

        AuditLog::record('promoted_to_recipient', $user, ['role' => 'applicant'], [
            'role' => 'recipient',
            'application_id' => $application->id,
        ], $admin->id);
    }

    /**
     * A rejected renewal ends the student's time as a recipient: their current placement
     * is closed and the account goes back to an active applicant account (signed out
     * everywhere, so the next sign-in opens the applicant dashboard). They can apply again
     * as a new applicant next semester (renewalWaitBlock). Their past terms, stubs and hours
     * stay on record (a completed placement can still be paid; the stub is emailed).
     */
    private function returnToApplicant(Application $renewal, User $admin): void
    {
        $user = User::find($renewal->user_id);
        if (!$user || $user->role !== 'recipient') {
            return;
        }

        $closed = Assignment::where('user_id', $user->id)->where('status', 'active')->get();
        foreach ($closed as $assignment) {
            $assignment->update(['status' => 'completed']);
        }
        // Back to an applicant account, still active: they sign in to the applicant dashboard
        // and can apply again next semester.
        $user->update(['role' => 'applicant']);
        // Open sessions end now, so the next sign-in lands on the applicant dashboard.
        $user->tokens()->delete();
        OneTimeCodeService::forgetDevices($user);

        AuditLog::record('returned_to_applicant', $user, ['role' => 'recipient'], [
            'role' => 'applicant',
            'renewal_application_id' => $renewal->id,
            'closed_assignment_ids' => $closed->pluck('id')->all(),
        ], $admin->id);
    }

    /** Create the next-term assignment for an approved renewal. */
    private function rolloverRenewal(Application $application, User $admin): void
    {
        $previous = $this->renewalReadiness->previousAssignment($application);

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

        // Close out the old term so the recipient has exactly one active assignment,
        // recording its Qualified/Deficient verdict now if the nightly job hasn't yet.
        app(TermStatusService::class)->close($previous, notify: false);
        $carry = $this->renewalReadiness->carryHours($previous);
        if ($previous->status === 'active') {
            $previous->update(['status' => 'completed']);
        }

        if ($carry > 0) {
            AuditLog::record('renewal_hours_carried', $application, null, [
                'hours' => $carry, 'from_assignment_id' => $previous->id,
            ], $admin->id);
        }

        $this->assignmentService->createAssignment([
            'user_id' => $application->user_id,
            'office_id' => $previous->office_id,
            'supervisor_id' => $previous->supervisor_id,
            'academic_year' => $application->academic_year,
            'semester' => $application->semester,
            // The term's base requirement, plus any unfinished promissory makeup hours
            // from the previous term (they are made up in this one).
            'required_hours' => $previous->baseRequiredHours() + $carry,
            'carried_over_hours' => $carry,
            'carried_from_assignment_id' => $carry > 0 ? $previous->id : null,
            // The new term's dates come from its semester period: it starts on the
            // period's first day (today if the DSA hasn't set the period up) and has
            // no end-date override, so the period's end date applies.
            'start_date' => app(SemesterPeriodService::class)
                ->forTerm($application->academic_year, $application->semester)?->start_date?->toDateString()
                ?? now()->toDateString(),
        // A returning recipient keeps their seat: a full office doesn't block a renewal.
        ], $admin, enforceCapacity: false);
    }

    public function attachDocument(Application $application, array $documentData): void
    {
        $application->documents()->create($documentData);
    }
}
