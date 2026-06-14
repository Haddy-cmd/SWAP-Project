<?php

namespace App\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NarrativeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'time_log_id' => $this->time_log_id,
            'content' => $this->content,
            'activities_done' => $this->activities_done,
            'challenges' => $this->challenges,
            'submitted_at' => $this->submitted_at?->toISOString(),
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
