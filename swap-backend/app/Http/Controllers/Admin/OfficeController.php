<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Office;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OfficeController extends Controller
{
    public function index(): JsonResponse
    {
        $offices = Office::withCount(['activeAssignments as active_recipients'])
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
}
