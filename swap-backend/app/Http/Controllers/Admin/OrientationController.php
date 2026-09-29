<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Orientation\InviteOrientationRequest;
use App\Http\Requests\Orientation\MarkOrientationAttendanceRequest;
use App\Http\Requests\Orientation\StoreOrientationSessionRequest;
use App\Models\OrientationSession;
use App\Resources\OrientationSessionResource;
use App\Services\OrientationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin → Orientation: schedule sessions, invite approved applicants, mark attendance. */
class OrientationController extends Controller
{
    public function __construct(private readonly OrientationService $orientation) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => OrientationSessionResource::collection($this->orientation->sessions())]);
    }

    /** Approved applicants not yet placed, with their orientation status. */
    public function candidates(): JsonResponse
    {
        return response()->json(['data' => $this->orientation->candidates()]);
    }

    public function store(StoreOrientationSessionRequest $request): JsonResponse
    {
        $session = $this->orientation->create($request->validated(), $request->user());

        return response()->json([
            'data' => new OrientationSessionResource($session),
            'message' => 'Orientation session created. Invite applicants to notify them.',
        ], 201);
    }

    public function update(StoreOrientationSessionRequest $request, int $id): JsonResponse
    {
        $session = $this->orientation->update(OrientationSession::findOrFail($id), $request->validated(), $request->user());

        return response()->json([
            'data' => new OrientationSessionResource($session),
            'message' => 'Orientation session updated.',
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $this->orientation->delete(OrientationSession::findOrFail($id), $request->user());

        return response()->json(['message' => 'Orientation session deleted.']);
    }

    public function invite(InviteOrientationRequest $request, int $id): JsonResponse
    {
        $session = OrientationSession::findOrFail($id);
        $result = $this->orientation->invite($session, $request->validated()['user_ids'] ?? null, $request->user());

        $message = $result['invited'] === 0
            ? 'Everyone selected is already invited to this session.'
            : "Invited {$result['invited']} applicant(s). They have been notified by email and in the portal.";

        return response()->json([
            'data' => new OrientationSessionResource($session->load(['attendees.user.profile', 'creator:id,name'])),
            'meta' => $result,
            'message' => $message,
        ]);
    }

    public function attendance(MarkOrientationAttendanceRequest $request, int $id): JsonResponse
    {
        $session = OrientationSession::findOrFail($id);
        $data = $request->validated();
        $this->orientation->mark($session, (int) $data['user_id'], $data['status'], $request->user());

        return response()->json([
            'data' => new OrientationSessionResource($session->load(['attendees.user.profile', 'creator:id,name'])),
            'message' => 'Attendance saved.',
        ]);
    }
}
