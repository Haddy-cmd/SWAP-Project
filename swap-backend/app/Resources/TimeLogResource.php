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
            'verifier' => $this->whenLoaded('verifier', fn () => $this->verifier ? [
                'id' => $this->verifier->id,
                'name' => $this->verifier->profile?->full_name ?? $this->verifier->name,
                'avatar_url' => $this->verifier->avatar_url,
            ] : null),
            'rejection_reason' => $this->rejection_reason,
            'clocked_out_reason' => $this->clocked_out_reason,
            // An open shift away from the office: when they left and when they'll be clocked out.
            'left_premises_at' => $this->status === 'open' ? $this->left_premises_at?->toISOString() : null,
            'auto_clock_out_deadline' => $this->status === 'open' && $this->left_premises_at
                ? \App\Services\AttendanceService::deadlineOf($this->resource)->toISOString()
                : null,
            // Time spent away from the office during the shift (not counted in duration_hours).
            'away_seconds' => (int) $this->away_seconds,
            'location_flagged' => (bool) $this->location_flagged,
            'location_flag_reason' => $this->location_flag_reason,
            'time_in_photo_url' => $this->time_in_photo_path
                ? rtrim(config('app.url'), '/') . '/api/attendance/' . $this->id . '/photo'
                    . ($request->bearerToken() ? '?token=' . urlencode($request->bearerToken()) : '')
                : null,
            'selfie_required' => $this->selfieRequired($request),
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
                'avatar_url' => $this->user->avatar_url,
            ]),
            'office' => $this->whenLoaded('assignment', fn () => $this->assignment->relationLoaded('office') && $this->assignment->office ? [
                'id' => $this->assignment->office->id,
                'name' => $this->assignment->office->name,
                'latitude' => $this->assignment->office->latitude,
                'longitude' => $this->assignment->office->longitude,
                'radius_meters' => $this->assignment->office->radius_meters,
                'geofence_enabled' => $this->assignment->office->geofence_enabled,
                'auto_clock_out' => $this->assignment->office->auto_clock_out,
            ] : null),
            // The term this log belongs to, from its assignment — lets the duty slip
            // group and navigate a student's duty by semester.
            'academic_year' => $this->whenLoaded('assignment', fn () => $this->assignment?->academic_year),
            'semester' => $this->whenLoaded('assignment', fn () => $this->assignment?->semester),
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

    /**
     * Whether a clock-in selfie was required for this shift (so a missing one is worth a look).
     * Recorded at clock-in; logs from before that follow the student's current setting, looked
     * up once per placement for the request.
     */
    private function selfieRequired(Request $request): bool
    {
        if ($this->is_manual) {
            return false;
        }
        if ($this->selfie_required !== null) {
            return (bool) $this->selfie_required;
        }
        if (!$this->assignment_id) {
            return true;
        }

        $key = 'selfie_required:' . $this->assignment_id;
        if (!$request->attributes->has($key)) {
            $assignment = $this->assignment ?? \App\Models\Assignment::find($this->assignment_id);
            $request->attributes->set($key, $assignment
                ? app(\App\Services\AttendanceService::class)->selfieRequiredFor($assignment)
                : true);
        }

        return (bool) $request->attributes->get($key);
    }
}
