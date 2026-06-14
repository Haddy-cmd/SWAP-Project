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
            'remarks' => $this->remarks,
            'reviewed_at' => $this->reviewed_at?->toISOString(),
            'created_at' => $this->created_at->toISOString(),
            'updated_at' => $this->updated_at->toISOString(),
            'user' => $this->whenLoaded('user', fn () => new UserResource($this->user)),
            'documents' => $this->whenLoaded('documents', fn () =>
                $this->documents->map(fn ($doc) => [
                    'id' => $doc->id,
                    'document_type' => $doc->document_type,
                    'file_url' => $doc->file_url,
                    'file_name' => $doc->file_name,
                    'file_size' => $doc->file_size,
                    'mime_type' => $doc->mime_type,
                ])
            ),
            'interview' => $this->whenLoaded('interview', fn () => $this->interview ? [
                'id' => $this->interview->id,
                'scheduled_at' => $this->interview->scheduled_at->toISOString(),
                'location' => $this->interview->location,
                'mode' => $this->interview->mode,
                'notes' => $this->interview->notes,
                'status' => $this->interview->status,
            ] : null),
        ];
    }
}
