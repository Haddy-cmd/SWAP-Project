<?php

namespace App\Http\Controllers\Supervisor;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    /** The supervisor's own attendance preferences. */
    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'data' => [
                'require_clock_in_selfie' => (bool) $request->user()->require_clock_in_selfie,
            ],
        ]);
    }

    /**
     * Turn the clock-in selfie requirement on or off for the students this
     * supervisor oversees. Only future clock-ins are affected — attendance
     * already recorded keeps whatever photo it was saved with.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'require_clock_in_selfie' => ['required', 'boolean'],
        ]);

        $user = $request->user();
        $user->update(['require_clock_in_selfie' => $validated['require_clock_in_selfie']]);

        return response()->json([
            'data' => ['require_clock_in_selfie' => (bool) $user->require_clock_in_selfie],
            'message' => $validated['require_clock_in_selfie']
                ? 'Students will be asked for a selfie when they clock in.'
                : 'Students can now clock in without a selfie.',
        ]);
    }
}
