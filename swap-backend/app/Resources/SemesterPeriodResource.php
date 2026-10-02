<?php

namespace App\Resources;

use App\Models\SemesterPeriod;
use App\Services\SemesterPeriodService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class SemesterPeriodResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $today = SemesterPeriodService::today();
        $phase = $this->phase($today);
        $end = Carbon::parse($this->end_date->toDateString(), SemesterPeriod::TIMEZONE);

        return [
            'id' => $this->id,
            'academic_year' => $this->academic_year,
            'semester' => $this->semester,
            'label' => $this->label(),
            'start_date' => $this->start_date->toDateString(),
            'end_date' => $this->end_date->toDateString(),
            'renewal_open' => (bool) $this->renewal_open,
            // upcoming | current | ended (Manila calendar day).
            'phase' => $phase,
            // Whole days left in the current term (0 on its last day).
            'days_left' => $phase === 'current' ? (int) $today->diffInDays($end) : null,
            'closed_at' => $this->closed_at?->toISOString(),
        ];
    }
}
