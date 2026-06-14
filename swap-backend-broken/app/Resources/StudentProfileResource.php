<?php

namespace App\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StudentProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'student_id_number' => $this->student_id_number,
            'first_name' => $this->first_name,
            'middle_name' => $this->middle_name,
            'last_name' => $this->last_name,
            'full_name' => $this->full_name,
            'date_of_birth' => $this->date_of_birth?->toDateString(),
            'gender' => $this->gender,
            'contact_number' => $this->contact_number,
            'address' => $this->address,
            'college' => $this->college,
            'program' => $this->program,
            'year_level' => $this->year_level,
            'gpa' => $this->gpa,
            'photo_url' => $this->photo_url,
        ];
    }
}
