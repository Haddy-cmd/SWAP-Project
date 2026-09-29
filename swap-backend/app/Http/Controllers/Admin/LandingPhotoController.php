<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Landing\ReorderLandingPhotosRequest;
use App\Http\Requests\Landing\UpdateLandingPhotoRequest;
use App\Http\Requests\Landing\UploadLandingPhotoRequest;
use App\Models\LandingPhoto;
use App\Resources\LandingPhotoResource;
use App\Services\LandingPhotoService;
use Illuminate\Http\JsonResponse;

/** Admin → Landing Page: manage the landing page carousel photos. */
class LandingPhotoController extends Controller
{
    public function __construct(private readonly LandingPhotoService $service) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => LandingPhotoResource::collection($this->service->all()),
            'meta' => ['max_photos' => LandingPhotoService::MAX_PHOTOS],
        ]);
    }

    public function store(UploadLandingPhotoRequest $request): JsonResponse
    {
        $photo = $this->service->upload($request->file('photo'), $request->validated()['caption'], $request->user());

        return response()->json([
            'data' => new LandingPhotoResource($photo),
            'message' => 'Photo added to the carousel.',
        ], 201);
    }

    public function update(UpdateLandingPhotoRequest $request, int $id): JsonResponse
    {
        $photo = $this->service->update($this->find($id), $request->validated(), $request->user());

        return response()->json([
            'data' => new LandingPhotoResource($photo),
            'message' => 'Photo updated.',
        ]);
    }

    public function reorder(ReorderLandingPhotosRequest $request): JsonResponse
    {
        $this->service->reorder($request->validated()['ids'], $request->user());

        return response()->json([
            'data' => LandingPhotoResource::collection($this->service->all()),
            'message' => 'Carousel order saved.',
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $this->service->delete($this->find($id), request()->user());

        return response()->json(['message' => 'Photo removed from the carousel.']);
    }

    private function find(int $id): LandingPhoto
    {
        return LandingPhoto::select(LandingPhoto::LIST_COLUMNS)->findOrFail($id);
    }
}
