<?php

namespace App\Http\Controllers\Applicant;

use App\Http\Controllers\Controller;
use App\Services\OrientationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The applicant's orientation invitations (dashboard card). */
class OrientationController extends Controller
{
    public function __construct(private readonly OrientationService $orientation) {}

    public function index(Request $request): JsonResponse
    {
        $rows = $this->orientation->forApplicant($request->user());

        return response()->json(['data' => $rows->map(fn ($a) => [
            'id' => $a->session->id,
            'title' => $a->session->title,
            'scheduled_at' => $a->session->scheduled_at->toISOString(),
            'mode' => $a->session->mode,
            'location' => $a->session->location,
            'meeting_link' => $a->session->meeting_link,
            'notes' => $a->session->notes,
            'status' => $a->status,
        ])]);
    }
}
