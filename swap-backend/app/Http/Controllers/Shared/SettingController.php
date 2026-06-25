<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    private const DEFAULT_CLOSED_MESSAGE = 'The application period has not started yet. Please check back later.';

    /** Public — lets the apply screen know whether the application period is open. */
    public function applicationStatus(): JsonResponse
    {
        $open = Setting::bool('applications_open', false);

        return response()->json([
            'data' => [
                'open' => $open,
                'message' => $open ? null : Setting::get('applications_closed_message', self::DEFAULT_CLOSED_MESSAGE),
            ],
        ]);
    }

    /** Admin — current settings for the management toggle. */
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => [
                'applications_open' => Setting::bool('applications_open', false),
                'applications_closed_message' => Setting::get('applications_closed_message', self::DEFAULT_CLOSED_MESSAGE),
            ],
        ]);
    }

    /** Admin — open or close the application period. */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'applications_open' => ['required', 'boolean'],
            'applications_closed_message' => ['nullable', 'string', 'max:255'],
        ]);

        Setting::put('applications_open', $validated['applications_open'] ? '1' : '0');

        if (array_key_exists('applications_closed_message', $validated) && $validated['applications_closed_message'] !== null) {
            Setting::put('applications_closed_message', $validated['applications_closed_message']);
        }

        return response()->json([
            'data' => [
                'applications_open' => Setting::bool('applications_open', false),
                'applications_closed_message' => Setting::get('applications_closed_message', self::DEFAULT_CLOSED_MESSAGE),
            ],
            'message' => $validated['applications_open'] ? 'Applications are now open.' : 'Applications are now closed.',
        ]);
    }
}
