<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\SemesterPeriodService;
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
                // Renewal is open for one semester period at a time (Admin → Semesters).
                'renewal' => $this->renewalPayload(),
            ],
        ]);
    }

    /** Admin — current settings for the management toggles. */
    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->settingsPayload()]);
    }

    /** Admin — open/close the application period. (Renewal is set per semester period.) */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'applications_open' => ['sometimes', 'boolean'],
            'applications_closed_message' => ['nullable', 'string', 'max:255'],
        ]);

        if (array_key_exists('applications_open', $validated)) {
            Setting::put('applications_open', $validated['applications_open'] ? '1' : '0');
        }

        if (array_key_exists('applications_closed_message', $validated) && $validated['applications_closed_message'] !== null) {
            Setting::put('applications_closed_message', $validated['applications_closed_message']);
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
        ];
    }

    /** @return array{open: bool, academic_year: ?string, semester: ?string} */
    private function renewalPayload(): array
    {
        $target = SemesterPeriodService::renewalTarget();

        return [
            'open' => $target !== null,
            'academic_year' => $target?->academic_year,
            'semester' => $target?->semester,
        ];
    }
}
