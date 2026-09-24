<?php

namespace App\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PromissoryNoteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'assignment_id' => $this->assignment_id,
            'user_id' => $this->user_id,
            'academic_year' => $this->academic_year,
            'semester' => $this->semester,
            'verified_hours_snapshot' => $this->verified_hours_snapshot,
            'lacking_hours' => $this->lacking_hours,
            // Fixed policy: exactly 1 week after the semester end (server-computed).
            'makeup_deadline' => $this->makeup_deadline?->toDateString(),
            // Late reviews still approve, but the deadline is flagged as passed.
            'overdue' => $this->makeup_deadline !== null
                && $this->status === \App\Models\PromissoryNote::STATUS_APPROVED
                && $this->makeup_deadline->isPast(),
            'file_name' => $this->file_name,
            'mime_type' => $this->mime_type,
            // Same ?token= serving pattern as application documents: the bearer
            // token is appended by the client so new-tab downloads keep working.
            'file_url' => rtrim(config('app.url'), '/').'/api/recipient/promissory/'.$this->id.'/file',
            'reason' => $this->reason,
            'status' => $this->status,
            'review_remarks' => $this->review_remarks,
            'reviewed_at' => $this->reviewed_at?->toISOString(),
            'created_at' => $this->created_at->toISOString(),
            'student' => $this->whenLoaded('student', fn () => [
                'id' => $this->student->id,
                'name' => $this->student->name,
            ]),
            'reviewer' => $this->whenLoaded('reviewer', fn () => $this->reviewer ? [
                'id' => $this->reviewer->id,
                'name' => $this->reviewer->name,
            ] : null),
        ];
    }
}
