<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\StudentProfile;
use App\Models\TimeLog;
use App\Support\DutySlipControl;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DutySlipController extends Controller
{
    /**
     * Verify a duty-slip Control No.: confirm the checksum, resolve the recipient,
     * and report the hours the system actually has on record for the encoded range
     * so the admin can compare them against the printed slip.
     */
    public function verify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'control_no' => ['required', 'string', 'max:100'],
        ]);

        $parsed = DutySlipControl::parse($validated['control_no']);

        if (!$parsed) {
            return response()->json(['data' => [
                'valid' => false,
                'reason' => 'This is not a valid SWAP control number format.',
            ]]);
        }

        // The system only ever prints whole-semester (SEM) and weekly (W<yyyymmdd>)
        // slips. Anything else — even with a matching checksum, which anyone can
        // compute — is not a slip we issued, and must not sum lifetime hours.
        $isWeek = (bool) preg_match('/^W(\d{4})(\d{2})(\d{2})$/', $parsed['range'], $week);
        if ($parsed['range'] !== 'SEM' && (!$isWeek || !checkdate((int) $week[2], (int) $week[3], (int) $week[1]))) {
            return response()->json(['data' => [
                'valid' => false,
                'reason' => 'This control number has an unrecognised coverage range.',
            ]]);
        }

        // Resolve the recipient by their student id (stored with punctuation).
        $profile = StudentProfile::whereRaw(
            "UPPER(REGEXP_REPLACE(student_id_number, '[^A-Za-z0-9]', '', 'g')) = ?",
            [$parsed['sid']]
        )->with('user')->first();

        $recipient = $profile?->user;

        // Sum the recorded hours for the encoded range, by the same rules the printed
        // slips use: rejected logs never count; regular + bonus (manual) hours do.
        $hours = null;
        $rangeLabel = $parsed['range'];

        if ($recipient) {
            $q = TimeLog::where('user_id', $recipient->id)
                ->whereNotNull('duration_hours')
                ->where('status', '!=', 'rejected');

            if ($parsed['range'] === 'SEM') {
                // A semester slip covers only its own term (the term lives on the assignment).
                $academicYear = DutySlipControl::academicYear($parsed['ay']);
                $semester = DutySlipControl::semesterName($parsed['sem']);
                $rangeLabel = 'Whole semester — ' . $semester . ', AY ' . ($academicYear ?? 'unknown');

                // Without a decodable year the term is ambiguous: summing the semester
                // across every year would report a number no slip ever printed.
                if ($academicYear) {
                    $q->whereHas('assignment', fn ($a) => $a->where('semester', $semester)->where('academic_year', $academicYear));
                    $hours = round((float) $q->sum('duration_hours'), 2);
                }
            } else {
                $start = Carbon::create((int) $week[1], (int) $week[2], (int) $week[3])->startOfDay();
                $end = $start->copy()->addDays(6); // full week Mon–Sun; Sunday duty counts as regular hours
                $q->whereBetween('date', [$start->toDateString(), $end->toDateString()]);
                $rangeLabel = 'Week of ' . $start->format('M j, Y');
                $hours = round((float) $q->sum('duration_hours'), 2);
            }
        }

        // Verification outcomes can decide whether a slip is accepted — keep a trail.
        AuditLog::record('duty_slip_verified', $recipient ?? $request->user(), null, [
            'control_no' => $validated['control_no'],
            'valid' => $parsed['valid'],
            'recorded_hours' => $hours,
        ]);

        return response()->json(['data' => [
            'valid' => $parsed['valid'],
            'student_id' => $profile?->student_id_number ?? $parsed['sid'],
            'academic_year' => $parsed['ay'],
            'semester' => $parsed['sem'],
            'range' => $rangeLabel,
            'recipient_found' => (bool) $recipient,
            'recipient_name' => $recipient?->name,
            'recorded_hours' => $hours,
        ]]);
    }
}
