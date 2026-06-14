<?php

namespace App\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StipendResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'amount' => $this->amount,
            'academic_year' => $this->academic_year,
            'semester' => $this->semester,
            'period_label' => $this->period_label,
            'status' => $this->status,
            'released_by' => $this->released_by,
            'released_at' => $this->released_at?->toISOString(),
            'remarks' => $this->remarks,
            'created_at' => $this->created_at->toISOString(),
            'recipient' => $this->whenLoaded('recipient', fn () => new UserResource($this->recipient)),
        ];
    }
}
