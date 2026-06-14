<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreAssignmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'office_id' => ['required', 'integer', 'exists:offices,id'],
            'supervisor_id' => ['required', 'integer', 'exists:users,id'],
            'academic_year' => ['required', 'string', 'regex:/^\d{4}-\d{4}$/'],
            'semester' => ['required', 'string', 'in:1st Semester,2nd Semester,Summer'],
            'required_hours' => ['required', 'integer', 'min:1', 'max:500'],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date', 'after:start_date'],
        ];
    }
}
