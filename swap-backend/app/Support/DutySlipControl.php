<?php

namespace App\Support;

/**
 * Shared parts of SWAP control numbers. The duty slip's own Control No.
 * (SWAP-{STUDENTID}-{YYYY}{SEM}-{RANGE}-{CHECKSUM}) is generated in the browser and
 * printed for reference only — paper slips are not official records, so there is no
 * verify endpoint. The claim stub's control number (StipendClaimService) reuses the
 * student-ID and term parts below so both read the same way.
 */
class DutySlipControl
{
    /** Student ID as it appears in control numbers: non-alphanumerics stripped, uppercased. */
    public static function studentRef(?string $studentId): string
    {
        return strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', (string) $studentId));
    }

    /** "2026-2027" + "2nd Semester" → "2627S2" (the term part of every control number). */
    public static function termCode(?string $academicYear, ?string $semester): string
    {
        $ay = preg_match('/^\d{2}(\d{2})-\d{2}(\d{2})$/', (string) $academicYear, $m) ? $m[1] . $m[2] : '0000';
        $sem = ['1st Semester' => 'S1', '2nd Semester' => 'S2', 'Summer' => 'SM'][(string) $semester] ?? 'S1';

        return $ay . $sem;
    }
}
