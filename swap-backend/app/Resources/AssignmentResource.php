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
            // Unfinished promissory makeup hours added from the previous term (included above).
            'carried_over_hours' => (int) ($this->carried_over_hours ?? 0),
            'carried_from_term' => $this->carried_over_hours > 0 && $this->carriedFrom
                ? "{$this->carriedFrom->semester} {$this->carriedFrom->academic_year}" : null,
            'pending_required_hours' => $this->pending_required_hours,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'status' => $this->status,
            'qr_code' => $this->qr_code,
            'rendered_hours' => $this->rendered_hours,
            'verified_hours' => $this->verified_hours,
            'pending_hours' => $this->pending_hours,
            'remaining_hours' => $this->remaining_hours,
            'pace' => $this->paceStatus(),
            // The term's last day: its own end date, else its semester period's.
            'effective_end_date' => $this->effectiveEndDate()?->toDateString(),
            // Persisted verdict (null = in progress) and the badge derived from it.
            'term_status' => $this->term_status,
            'deficient_hours' => $this->deficient_hours !== null ? (float) $this->deficient_hours : null,
            'term_status_reason' => $this->term_status_reason,
            'term_status_at' => $this->term_status_at?->toISOString(),
            'term_badge' => $this->termBadge(),
            // The supervisor's end-of-term evaluation, where the list loads it.
            // (when(), not whenLoaded(): a loaded-but-missing evaluation must still say "due".)
            'evaluation' => $this->when($this->resource->relationLoaded('evaluation'), fn () => $this->evaluation?->toPayload()),
            'evaluation_due' => $this->when($this->resource->relationLoaded('evaluation'), fn () => \App\Services\TermEvaluationService::isDue($this->resource, $this->evaluation !== null)),
            'pending_logs_count' => (int) ($this->pending_logs_count ?? 0),
            'created_at' => $this->created_at->toISOString(),
            'user' => $this->whenLoaded('user', fn () => new UserResource($this->user)),
            'office' => $this->whenLoaded('office', fn () => [
                'id' => $this->office->id,
                'name' => $this->office->name,
                'logo_url' => $this->office->logo_url,
                'location' => $this->office->location,
                'head_name' => $this->office->head_name,
            ]),
            'office_name' => $this->whenLoaded('office', fn () => $this->office?->name),
            'supervisor' => $this->whenLoaded('supervisor', fn () => new UserResource($this->supervisor)),
            // Whether a clock-in selfie is required for this student. Resolved by
            // the same rule the clock-in itself enforces, so the UI never shows
            // a step the API would skip (or skips one it would reject). Only the
            // student's own clock-in pages need it, so rosters and admin lists skip
            // the per-row supervisor lookup.
            'selfie_required' => $this->when(
                $request->user()?->id === $this->user_id,
                fn () => app(\App\Services\AttendanceService::class)->selfieRequiredFor($this->resource),
            ),
        ];
    }
}
