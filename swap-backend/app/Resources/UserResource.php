<?php

namespace App\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'is_active' => $this->is_active,
            'office_id' => $this->office_id,
            'office_name' => $this->whenLoaded('office', fn () => $this->office?->name),
            'email_verified_at' => $this->email_verified_at?->toISOString(),
            'created_at' => $this->created_at->toISOString(),
            // Base URL of the profile photo (streamed; the client appends ?token=).
            // Null when the user hasn't uploaded one.
            'avatar_url' => $this->avatar_path
                ? rtrim(config('app.url'), '/') . '/api/users/' . $this->id . '/avatar'
                : null,
            'profile' => $this->whenLoaded('profile', fn () => new StudentProfileResource($this->profile)),
        ];
    }
}
