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
            'control_number' => $this->control_number,
            'certified_by' => $this->certified_by,
            'certified_at' => $this->certified_at?->toISOString(),
            'released_by' => $this->released_by,
            'released_at' => $this->released_at?->toISOString(),
            'claimed_at' => $this->claimed_at?->toISOString(),
            'releasing_officer_name' => $this->releasing_officer_name,
            'void_reason' => $this->void_reason,
            // The claim slip PDF is downloadable once certified (via /recipient/stipend/{id}/slip).
            'has_slip' => in_array($this->status, ['certified', 'claimed'], true),
            'remarks' => $this->remarks,
            'created_at' => $this->created_at->toISOString(),
            'recipient' => $this->whenLoaded('recipient', fn () => new UserResource($this->recipient)),
            'certifier' => $this->whenLoaded('certifiedBy', fn () => $this->certifiedBy ? [
                'id' => $this->certifiedBy->id,
                'name' => $this->certifiedBy->name,
            ] : null),
            'signatures' => $this->whenLoaded('signatures', fn () => $this->signatures->map(fn ($s) => [
                'signatory_role' => $s->signatory_role,
                'printed_name' => $s->printed_name,
                'method' => $s->method,
                'signed_at' => $s->signed_at?->toISOString(),
                'remarks' => $s->remarks,
            ])),
        ];
    }
}
