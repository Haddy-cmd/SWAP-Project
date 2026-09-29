<?php

namespace App\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** A carousel slide as the admin editor sees it (never the image bytes). */
class LandingPhotoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'caption' => $this->caption,
            'url' => $this->resource->url(),
            'is_active' => $this->is_active,
            'sort_order' => $this->sort_order,
            'source' => $this->resource->isUploaded() ? 'uploaded' : 'built_in',
            'width' => $this->width,
            'height' => $this->height,
            'byte_size' => $this->byte_size,
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
