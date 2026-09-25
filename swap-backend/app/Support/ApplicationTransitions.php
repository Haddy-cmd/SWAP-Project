<?php

namespace App\Support;

use App\Models\Application;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * The application state machine, enforced server-side (the admin pages only hide
 * buttons). Transitions:
 *
 *   submitted           → under_review | interview_scheduled | rejected | approved (renewal)
 *   under_review        → interview_scheduled | rejected | approved (renewal)
 *   interview_scheduled → interview_scheduled (reschedule) | approved | rejected
 *   approved, rejected  → terminal
 *
 * Approving a fresh application needs a held (not no-show) interview; renewals
 * skip the interview entirely. Every refusal is a 409 with one of the messages
 * below, mirrored verbatim by the frontend.
 */
final class ApplicationTransitions
{
    public const DECIDED = ['approved', 'rejected'];

    public const MSG_DECIDED = 'This application has already been decided.';
    public const MSG_PAST_REVIEW = 'This application is already past the review step.';
    public const MSG_ALREADY_SCHEDULED = 'An interview is already scheduled. Reschedule it instead.';
    public const MSG_NO_INTERVIEW = 'An interview must be scheduled before this application can be approved.';
    public const MSG_NO_SHOW = 'The applicant missed the interview. Reschedule it before approving.';

    /** Any change at all: a decided application is closed. */
    public static function assertOpen(Application $application): void
    {
        if (in_array($application->status, self::DECIDED, true)) {
            throw new ConflictHttpException(self::MSG_DECIDED);
        }
    }

    public static function assertCanMarkUnderReview(Application $application): void
    {
        self::assertOpen($application);

        if ($application->status !== 'submitted') {
            throw new ConflictHttpException(self::MSG_PAST_REVIEW);
        }
    }

    /** First scheduling only — moving an existing interview is a reschedule. */
    public static function assertCanScheduleInterview(Application $application): void
    {
        self::assertOpen($application);

        if ($application->status === 'interview_scheduled') {
            throw new ConflictHttpException(self::MSG_ALREADY_SCHEDULED);
        }
    }

    public static function assertCanDecide(Application $application, string $decision): void
    {
        self::assertOpen($application);

        if ($decision !== 'approved' || $application->type === 'renewal') {
            return;
        }

        if ($application->status !== 'interview_scheduled') {
            throw new ConflictHttpException(self::MSG_NO_INTERVIEW);
        }

        if ($application->interview?->status === 'no_show') {
            throw new ConflictHttpException(self::MSG_NO_SHOW);
        }
    }
}
