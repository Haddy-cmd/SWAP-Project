<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One slide of the landing page carousel: either a built-in photo shipped with
 * the frontend (`bundled_path`) or an admin upload stored (base64) in `image_base64`.
 */
class LandingPhoto extends Model
{
    /** Everything except the image bytes — list queries select only these. */
    public const LIST_COLUMNS = [
        'id', 'caption', 'sort_order', 'is_active', 'bundled_path', 'mime_type',
        'width', 'height', 'byte_size', 'uploaded_by', 'created_at', 'updated_at',
    ];

    protected $fillable = [
        'caption', 'sort_order', 'is_active', 'bundled_path', 'image_base64',
        'mime_type', 'width', 'height', 'byte_size', 'uploaded_by',
    ];

    protected $hidden = ['image_base64'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /** Active slides in carousel order, without the image bytes. */
    public function scopeForCarousel(Builder $query): Builder
    {
        return $query->select(self::LIST_COLUMNS)->where('is_active', true)->orderBy('sort_order')->orderBy('id');
    }

    public function isUploaded(): bool
    {
        return $this->bundled_path === null;
    }

    /**
     * Where the browser loads the photo. Built-in photos are frontend paths; uploads
     * are served by the API, versioned by their last change so they cache forever.
     */
    public function url(): string
    {
        if (!$this->isUploaded()) {
            return $this->bundled_path;
        }

        return rtrim(config('app.url'), '/') . "/api/landing/photos/{$this->id}/image?v=" . $this->updated_at?->timestamp;
    }
}
