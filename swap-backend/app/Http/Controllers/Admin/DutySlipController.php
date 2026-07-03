<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
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

        // Resolve the recipient by their student id (stored with punctuation).
        $profile = StudentProfile::whereRaw(
            "UPPER(REGEXP_REPLACE(student_id_number, '[^A-Za-z0-9]', '', 'g')) = ?",
            [$parsed['sid']]
        )->with('user')->first();

        $recipient = $profile?->user;

        // Sum the recorded hours for the encoded range.
        $hours = null;
        $rangeLabel = $parsed['range'];

        if ($recipient) {
            $q = TimeLog::where('user_id', $recipient->id)->whereNotNull('duration_hours');

            if ($parsed['range'] === 'SEM') {
                $rangeLabel = 'Whole semester';
            } elseif (preg_match('/^W(\d{4})(\d{2})(\d{2})$/', $parsed['range'], $m)) {
                $start = Carbon::create((int) $m[1], (int) $m[2], (int) $m[3])->startOfDay();
                $end = $start->copy()->addDays(6); // full week Mon–Sun; Sunday duty counts as regular hours
                $q->whereBetween('date', [$start->toDateString(), $end->toDateString()]);
                $rangeLabel = 'Week of ' . $start->format('M j, Y');
            }

            $hours = round((float) $q->sum('duration_hours'), 2);
        }

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
