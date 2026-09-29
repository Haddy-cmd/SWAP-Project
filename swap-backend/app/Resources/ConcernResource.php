<?php

namespace App\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ConcernResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'subject' => $this->subject,
            'message' => $this->message,
            'status' => $this->status,
            'response' => $this->response,
            'responded_at' => $this->responded_at?->toISOString(),
            'responded_by' => $this->whenLoaded('respondedBy', fn () => $this->respondedBy?->name),
            'created_at' => $this->created_at?->toISOString(),
            // Only on the admin inbox; the student's own list does not load it.
            'user' => $this->whenLoaded('user', fn () => $this->user ? [
                'id' => $this->user->id,
                'name' => $this->user->profile?->full_name ?: $this->user->name,
                'email' => $this->user->email,
                'role' => $this->user->role,
            ] : null),
        ];
    }
}
