<?php

namespace App\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ApplicationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'academic_year' => $this->academic_year,
            'semester' => $this->semester,
            'status' => $this->status,
            'type' => $this->type ?? 'new',
            // For renewals: the service record being renewed, so the admin can
            // decide on evidence (previous office/supervisor + hours rendered).
            'renewal_context' => $this->when(($this->type ?? 'new') === 'renewal', function () {
                $prev = \App\Models\Assignment::with(['office', 'supervisor'])
                    ->withSum(['timeLogs as verified_sum' => fn ($q) => $q->where('status', 'verified')], 'duration_hours')
                    ->where('user_id', $this->user_id)
                    ->where(fn ($q) => $q->where('academic_year', '!=', $this->academic_year)
                        ->orWhere('semester', '!=', $this->semester))
                    ->orderByDesc('id')
                    ->first();
                if (!$prev) {
                    return null;
                }
                return [
                    'office' => $prev->office?->name,
                    'supervisor' => $prev->supervisor?->name,
                    'period' => "{$prev->academic_year} — {$prev->semester}",
                    'verified_hours' => $prev->verified_hours,
                    'required_hours' => $prev->required_hours,
                    'status' => $prev->status,
                ];
            }),
            'remarks' => $this->remarks,
            'reviewed_at' => $this->reviewed_at?->toISOString(),
            'created_at' => $this->created_at->toISOString(),
            'updated_at' => $this->updated_at->toISOString(),
            'user' => $this->whenLoaded('user', fn () => new UserResource($this->user)),
            'documents' => $this->whenLoaded('documents', function () use ($request) {
                $token = $request->bearerToken();
                return $this->documents->map(function ($doc) use ($token) {
                    $url = rtrim(config('app.url'), '/') . '/api/documents/' . $doc->id . '/file';
                    if ($token) {
                        $url .= '?token=' . urlencode($token);
                    }
                    return [
                        'id' => $doc->id,
                        'document_type' => $doc->document_type,
                        'file_url' => $url,
                        'file_name' => $doc->file_name,
                        'file_size' => $doc->file_size,
                        'mime_type' => $doc->mime_type,
                    ];
                });
            }),
            'interview' => $this->whenLoaded('interview', fn () => $this->interview ? [
                'id' => $this->interview->id,
                'scheduled_at' => $this->interview->scheduled_at->toISOString(),
                'location' => $this->interview->location,
                'meeting_link' => $this->interview->meeting_link,
                'duration_minutes' => $this->interview->duration_minutes,
                'mode' => $this->interview->mode,
                'notes' => $this->interview->notes,
                'status' => $this->interview->status,
                // Reschedule trail: previous time, new time, who moved it, when.
                // Eager-loaded on the list page; a single application loads it here.
                'history' => $this->interview->loadMissing('rescheduleHistory.user')->rescheduleHistory
                    ->map(fn ($log) => [
                        'from' => $log->old_values['scheduled_at'] ?? null,
                        'to' => $log->new_values['scheduled_at'] ?? null,
                        'changed_at' => $log->created_at->toISOString(),
                        'changed_by' => $log->user?->name,
                    ])->values(),
            ] : null),
        ];
    }
}
