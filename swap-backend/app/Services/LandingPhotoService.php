<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\LandingPhoto;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * Admin management of the landing page carousel (Admin → Landing Page).
 * Every change is audit-logged and refreshes the cached public list.
 */
class LandingPhotoService
{
    /** Hard cap so the database stays small (uploads live in it). */
    public const MAX_PHOTOS = 30;

    /** Uploads are resized to this width at most — plenty for a full-bleed hero. */
    public const MAX_WIDTH = 1600;

    private const JPEG_QUALITY = 82;

    private const CACHE_KEY = 'landing:photos';

    public const MSG_LIMIT = 'The carousel already has 30 photos. Delete one before adding another.';
    public const MSG_UNREADABLE = 'This image could not be read. Please upload a JPG, PNG or WEBP photo.';
    public const MSG_ORDER = 'Send every photo in the new order.';

    /** The public carousel: active slides in order, cached for 10 minutes. */
    public function carousel(): Collection
    {
        return Cache::remember(self::CACHE_KEY, 600, fn () => LandingPhoto::forCarousel()->get()
            ->map(fn (LandingPhoto $p) => ['id' => $p->id, 'caption' => $p->caption, 'url' => $p->url()])
            ->values());
    }

    /** Every slide (shown and hidden) for the admin editor, without the image bytes. */
    public function all(): Collection
    {
        return LandingPhoto::select(LandingPhoto::LIST_COLUMNS)->orderBy('sort_order')->orderBy('id')->get();
    }

    public function upload(UploadedFile $file, string $caption, User $admin): LandingPhoto
    {
        if (LandingPhoto::count() >= self::MAX_PHOTOS) {
            throw new UnprocessableEntityHttpException(self::MSG_LIMIT);
        }

        [$jpeg, $width, $height] = $this->toJpeg($file);

        $photo = LandingPhoto::create([
            'caption' => $caption,
            'sort_order' => ((int) LandingPhoto::max('sort_order')) + 1,
            'is_active' => true,
            'image_base64' => base64_encode($jpeg),
            'mime_type' => 'image/jpeg',
            'width' => $width,
            'height' => $height,
            'byte_size' => strlen($jpeg),
            'uploaded_by' => $admin->id,
        ]);

        AuditLog::record('created', $photo, null, $photo->only(['caption', 'width', 'height', 'byte_size']), $admin->id);
        $this->forgetCache();

        return $photo;
    }

    public function update(LandingPhoto $photo, array $data, User $admin): LandingPhoto
    {
        $changes = array_intersect_key($data, array_flip(['caption', 'is_active']));
        $old = $photo->only(array_keys($changes));

        $photo->update($changes);

        AuditLog::record('updated', $photo, $old, $photo->only(array_keys($changes)), $admin->id);
        $this->forgetCache();

        return $photo;
    }

    /** @param int[] $ids every photo id, in the new order */
    public function reorder(array $ids, User $admin): void
    {
        $all = LandingPhoto::pluck('id')->all();
        if (count($ids) !== count($all) || array_diff($all, $ids)) {
            throw new UnprocessableEntityHttpException(self::MSG_ORDER);
        }

        $before = LandingPhoto::orderBy('sort_order')->orderBy('id')->pluck('id')->all();

        DB::transaction(function () use ($ids) {
            foreach (array_values($ids) as $position => $id) {
                LandingPhoto::whereKey($id)->update(['sort_order' => $position + 1]);
            }
        });

        // One trail entry for the whole reorder, attached to the first slide.
        AuditLog::record('reordered', LandingPhoto::findOrFail($ids[0]), ['order' => $before], ['order' => array_values($ids)], $admin->id);
        $this->forgetCache();
    }

    public function delete(LandingPhoto $photo, User $admin): void
    {
        AuditLog::record('deleted', $photo, $photo->only(['caption', 'bundled_path', 'sort_order']), null, $admin->id);
        $photo->delete();
        $this->forgetCache();
    }

    /**
     * Decode any JPG/PNG/WEBP, apply the phone's rotation, shrink to MAX_WIDTH and
     * re-encode as JPEG on white (transparency flattened).
     *
     * @return array{0: string, 1: int, 2: int} [jpeg bytes, width, height]
     */
    private function toJpeg(UploadedFile $file): array
    {
        $image = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));
        if (!$image) {
            throw new UnprocessableEntityHttpException(self::MSG_UNREADABLE);
        }

        if (function_exists('exif_read_data') && $file->getMimeType() === 'image/jpeg') {
            $orientation = (@exif_read_data($file->getRealPath()) ?: [])['Orientation'] ?? 1;
            $image = match ((int) $orientation) {
                3 => imagerotate($image, 180, 0),
                6 => imagerotate($image, -90, 0),
                8 => imagerotate($image, 90, 0),
                default => $image,
            };
        }

        if (imagesx($image) > self::MAX_WIDTH) {
            $image = imagescale($image, self::MAX_WIDTH, -1, IMG_BICUBIC);
        }

        $width = imagesx($image);
        $height = imagesy($image);

        $canvas = imagecreatetruecolor($width, $height);
        imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
        imagecopy($canvas, $image, 0, 0, 0, 0, $width, $height);

        ob_start();
        imagejpeg($canvas, null, self::JPEG_QUALITY);

        return [(string) ob_get_clean(), $width, $height];
    }

    private function forgetCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
