<?php

namespace App\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssignmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'office_id' => $this->office_id,
            'supervisor_id' => $this->supervisor_id,
            'academic_year' => $this->academic_year,
            'semester' => $this->semester,
            'required_hours' => $this->required_hours,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'status' => $this->status,
            'qr_code' => $this->qr_code,
            'rendered_hours' => $this->rendered_hours,
            'verified_hours' => $this->verified_hours,
            'remaining_hours' => $this->remaining_hours,
            'pending_logs_count' => (int) ($this->pending_logs_count ?? 0),
            'created_at' => $this->created_at->toISOString(),
            'user' => $this->whenLoaded('user', fn () => new UserResource($this->user)),
            'office' => $this->whenLoaded('office', fn () => [
                'id' => $this->office->id,
                'name' => $this->office->name,
                'code' => $this->office->code,
                'location' => $this->office->location,
                'head_name' => $this->office->head_name,
            ]),
            'supervisor' => $this->whenLoaded('supervisor', fn () => new UserResource($this->supervisor)),
        ];
    }
}
