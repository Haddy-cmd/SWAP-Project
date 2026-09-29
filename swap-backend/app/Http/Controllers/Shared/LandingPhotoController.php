<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Models\LandingPhoto;
use App\Services\LandingPhotoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

/** Public: the landing page carousel and the uploaded photos it shows. */
class LandingPhotoController extends Controller
{
    public function __construct(private readonly LandingPhotoService $service) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->service->carousel()]);
    }

    /**
     * An uploaded photo's bytes. The URL is versioned, so browsers may cache it forever.
     * Hidden slides are served too — the admin editor shows their thumbnails.
     */
    public function image(int $id): Response
    {
        $photo = LandingPhoto::whereKey($id)->whereNotNull('image_base64')
            ->first(['id', 'image_base64', 'mime_type']);

        abort_if(!$photo, 404);

        return response(base64_decode($photo->image_base64), 200, [
            'Content-Type' => $photo->mime_type ?: 'image/jpeg',
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }
}
