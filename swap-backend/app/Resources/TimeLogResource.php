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
            'clocked_out_reason' => $this->clocked_out_reason,
            'location_flagged' => (bool) $this->location_flagged,
            'is_manual' => (bool) $this->is_manual,
            'manual_reason' => $this->manual_reason,
            'time_in_lat' => $this->time_in_lat,
            'time_in_lng' => $this->time_in_lng,
            'time_in_accuracy' => $this->time_in_accuracy,
            'time_out_lat' => $this->time_out_lat,
            'time_out_lng' => $this->time_out_lng,
            'time_out_accuracy' => $this->time_out_accuracy,
            'created_at' => $this->created_at->toISOString(),
            'user' => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id,
                'name' => $this->user->profile?->full_name ?? $this->user->name,
            ]),
            'office' => $this->whenLoaded('assignment', fn () => $this->assignment->relationLoaded('office') && $this->assignment->office ? [
                'id' => $this->assignment->office->id,
                'name' => $this->assignment->office->name,
                'latitude' => $this->assignment->office->latitude,
                'longitude' => $this->assignment->office->longitude,
                'radius_meters' => $this->assignment->office->radius_meters,
                'geofence_enabled' => $this->assignment->office->geofence_enabled,
            ] : null),
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
