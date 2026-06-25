<?php

namespace App\Http\Controllers\Supervisor;

use App\Http\Controllers\Controller;
use App\Services\QrCodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OfficeController extends Controller
{
    public function __construct(private readonly QrCodeService $qrCodeService) {}

    /** The signed attendance QR for the supervisor's own office. */
    public function qr(Request $request): JsonResponse
    {
        $office = $request->user()->load('office')->office;

        if (!$office) {
            return response()->json([
                'message' => 'You are not assigned to an office yet. Please contact the DSA office.',
            ], 404);
        }

        // Reuse the existing signed token; only mint one if the office has none,
        // so any QR already printed by the admin keeps working.
        $token = $office->qr_code ?: $this->qrCodeService->generateForOffice($office);

        return response()->json([
            'data' => [
                'office' => [
                    'id' => $office->id,
                    'name' => $office->name,
                    'location' => $office->location,
                ],
                'qr_code' => $token,
            ],
        ]);
    }
}
