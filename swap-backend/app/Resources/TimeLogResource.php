<?php

namespace App\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TimeLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'assignment_id' => $this->assignment_id,
            'user_id' => $this->user_id,
            'date' => $this->date?->toDateString(),
            'time_in' => $this->time_in?->toISOString(),
            'time_out' => $this->time_out?->toISOString(),
            'duration_hours' => $this->duration_hours,
            'status' => $this->status,
            'verified_by' => $this->verified_by,
            'verified_at' => $this->verified_at?->toISOString(),
            'rejection_reason' => $this->rejection_reason,
            'created_at' => $this->created_at->toISOString(),
            'has_narrative' => $this->whenLoaded('narrativeReport', fn () => $this->narrativeReport !== null, false),
            'narrative_report' => $this->whenLoaded('narrativeReport', fn () => $this->narrativeReport ? new NarrativeResource($this->narrativeReport) : null),
            'verifications' => $this->whenLoaded('verifications', fn () =>
                $this->verifications->map(fn ($v) => [
                    'id' => $v->id,
                    'action' => $v->action,
                    'feedback' => $v->feedback,
                    'verified_by' => $v->verified_by,
                    'created_at' => $v->created_at->toISOString(),
                ])
            ),
        ];
    }
}
