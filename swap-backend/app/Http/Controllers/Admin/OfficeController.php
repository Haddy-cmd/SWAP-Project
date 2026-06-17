<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Office;
use App\Models\User;
use App\Resources\UserResource;
use App\Services\QrCodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OfficeController extends Controller
{
    public function __construct(private readonly QrCodeService $qrCodeService) {}

    public function index(): JsonResponse
    {
        $offices = Office::withCount([
            'activeAssignments as active_recipients',
            'supervisors as supervisors_count',
        ])
            ->orderBy('name')
            ->paginate(15);

        return response()->json([
            'data' => $offices->items(),
            'meta' => [
                'current_page' => $offices->currentPage(),
                'last_page' => $offices->lastPage(),
                'total' => $offices->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'code' => ['required', 'string', 'max:20', 'unique:offices,code'],
            'description' => ['nullable', 'string', 'max:500'],
            'head_name' => ['nullable', 'string', 'max:150'],
            'location' => ['nullable', 'string', 'max:255'],
            'max_recipients' => ['required', 'integer', 'min:1'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'radius_meters' => ['nullable', 'integer', 'min:10', 'max:1000'],
            'geofence_enabled' => ['sometimes', 'boolean'],
        ]);

        $office = Office::create($validated);

        return response()->json(['data' => $office, 'message' => 'Office created.'], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $office = Office::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'code' => ['sometimes', 'string', 'max:20', "unique:offices,code,{$id}"],
            'description' => ['nullable', 'string', 'max:500'],
            'head_name' => ['nullable', 'string', 'max:150'],
            'location' => ['nullable', 'string', 'max:255'],
            'max_recipients' => ['sometimes', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'radius_meters' => ['nullable', 'integer', 'min:10', 'max:1000'],
            'geofence_enabled' => ['sometimes', 'boolean'],
        ]);

        $office->update($validated);

        return response()->json(['data' => $office, 'message' => 'Office updated.']);
    }

    public function destroy(int $id): JsonResponse
    {
        $office = Office::findOrFail($id);
        $office->update(['is_active' => false]);

        return response()->json(['message' => 'Office deactivated.']);
    }

    /**
     * Generate (or regenerate) the shared geofence QR code for an office.
     */
    public function qr(int $id): JsonResponse
    {
        $office = Office::findOrFail($id);

        $token = $this->qrCodeService->generateForOffice($office);

        return response()->json([
            'data' => ['qr_code' => $token],
            'message' => 'Office QR code generated.',
        ]);
    }

    /**
     * List the supervisors assigned to an office.
     */
    public function supervisors(int $id): JsonResponse
    {
        $office = Office::findOrFail($id);

        return response()->json([
            'data' => UserResource::collection($office->supervisors()->orderBy('name')->get()),
        ]);
    }

    /**
     * Assign a supervisor to this office. A supervisor belongs to exactly one office,
     * so this moves them here if they were assigned elsewhere.
     */
    public function assignSupervisor(Request $request, int $id): JsonResponse
    {
        $office = Office::findOrFail($id);

        $validated = $request->validate([
            'supervisor_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $supervisor = User::findOrFail($validated['supervisor_id']);

        if (!$supervisor->isSupervisor()) {
            return response()->json(['message' => 'Only supervisors can be assigned to an office.'], 422);
        }

        $supervisor->update(['office_id' => $office->id]);

        return response()->json([
            'data' => new UserResource($supervisor->fresh('office')),
            'message' => "{$supervisor->name} assigned to {$office->name}.",
        ]);
    }

    /**
     * Remove a supervisor from this office.
     */
    public function removeSupervisor(int $id, int $supervisorId): JsonResponse
    {
        $office = Office::findOrFail($id);

        $supervisor = User::where('id', $supervisorId)
            ->where('office_id', $office->id)
            ->first();

        if (!$supervisor) {
            return response()->json(['message' => 'Supervisor is not assigned to this office.'], 404);
        }

        $supervisor->update(['office_id' => null]);

        return response()->json(['message' => "{$supervisor->name} removed from {$office->name}."]);
    }
}
