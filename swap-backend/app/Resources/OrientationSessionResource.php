<?php

namespace App\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrientationSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'scheduled_at' => $this->scheduled_at?->toISOString(),
            'mode' => $this->mode,
            'location' => $this->location,
            'meeting_link' => $this->meeting_link,
            'notes' => $this->notes,
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'attendees' => $this->whenLoaded('attendees', fn () => $this->attendees
                ->sortBy(fn ($a) => mb_strtolower($a->user?->profile?->full_name ?: $a->user?->name ?? ''))
                ->values()
                ->map(fn ($a) => [
                    'user_id' => $a->user_id,
                    'name' => $a->user?->profile?->full_name ?: $a->user?->name,
                    'student_id' => $a->user?->profile?->student_id_number,
                    'status' => $a->status,
                    'marked_at' => $a->marked_at?->toISOString(),
                ])),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
