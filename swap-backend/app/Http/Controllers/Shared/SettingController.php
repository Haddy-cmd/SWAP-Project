<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    private const DEFAULT_CLOSED_MESSAGE = 'The application period has not started yet. Please check back later.';

    /**
     * Public — lets the apply screen know whether the application period is open,
     * and the renewal page whether the renewal window is open (and for which term).
     */
    public function applicationStatus(): JsonResponse
    {
        $open = Setting::bool('applications_open', false);

        return response()->json([
            'data' => [
                'open' => $open,
                'message' => $open ? null : Setting::get('applications_closed_message', self::DEFAULT_CLOSED_MESSAGE),
                'renewal' => [
                    'open' => Setting::bool('renewal_open', false),
                    'academic_year' => Setting::get('renewal_year'),
                    'semester' => Setting::get('renewal_semester'),
                ],
            ],
        ]);
    }

    /** Admin — current settings for the management toggles. */
    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->settingsPayload()]);
    }

    /** Admin — open/close the application period and the renewal window. */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'applications_open' => ['sometimes', 'boolean'],
            'applications_closed_message' => ['nullable', 'string', 'max:255'],
            'renewal_open' => ['sometimes', 'boolean'],
            'renewal_year' => ['sometimes', 'nullable', 'string', 'max:20'],
            'renewal_semester' => ['sometimes', 'nullable', 'string', 'max:30'],
        ]);

        if (array_key_exists('applications_open', $validated)) {
            Setting::put('applications_open', $validated['applications_open'] ? '1' : '0');
        }

        if (array_key_exists('applications_closed_message', $validated) && $validated['applications_closed_message'] !== null) {
            Setting::put('applications_closed_message', $validated['applications_closed_message']);
        }

        if (array_key_exists('renewal_open', $validated)) {
            Setting::put('renewal_open', $validated['renewal_open'] ? '1' : '0');
        }

        if (array_key_exists('renewal_year', $validated) && $validated['renewal_year'] !== null) {
            Setting::put('renewal_year', $validated['renewal_year']);
        }

        if (array_key_exists('renewal_semester', $validated) && $validated['renewal_semester'] !== null) {
            Setting::put('renewal_semester', $validated['renewal_semester']);
        }

        return response()->json([
            'data' => $this->settingsPayload(),
            'message' => 'Settings updated.',
        ]);
    }

    private function settingsPayload(): array
    {
        return [
            'applications_open' => Setting::bool('applications_open', false),
            'applications_closed_message' => Setting::get('applications_closed_message', self::DEFAULT_CLOSED_MESSAGE),
            'renewal_open' => Setting::bool('renewal_open', false),
            'renewal_year' => Setting::get('renewal_year'),
            'renewal_semester' => Setting::get('renewal_semester'),
        ];
    }
}
