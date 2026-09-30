<?php

namespace App\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AnnouncementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'message' => $this->message,
            'sent_by' => $this->whenLoaded('sender', fn () => $this->sender?->name),
            'recipient_count' => $this->recipient_count,
            'emailed_count' => $this->emailed_count,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
