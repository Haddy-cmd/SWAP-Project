<?php

namespace App\Support;

/**
 * Why an application was not approved. The admin picks one when rejecting; the
 * applicant sees the label, and Analytics counts them. Labels and messages are
 * mirrored verbatim by the frontend (lib/utils/rejection.ts).
 */
final class RejectionReasons
{
    public const LABELS = [
        'incomplete_documents' => 'Incomplete or invalid documents',
        'grade_requirement' => 'Grade requirement not met',
        'no_slots' => 'No available slots this semester',
        'missed_interview' => 'Did not attend the interview',
        'other' => 'Other',
    ];

    public const MSG_REASON_REQUIRED = 'Choose a reason for not approving this application.';
    public const MSG_NOTE_REQUIRED = 'Explain the reason in at least 10 characters.';
    public const NOTE_MIN = 10;

    public static function keys(): array
    {
        return array_keys(self::LABELS);
    }

    public static function label(?string $key): ?string
    {
        return $key ? (self::LABELS[$key] ?? null) : null;
    }
}
