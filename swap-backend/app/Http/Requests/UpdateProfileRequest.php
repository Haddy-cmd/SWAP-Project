<?php

namespace App\Http\Requests;

use App\Support\EmployeeId;
use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'position_title' => ['nullable', 'string', 'max:150'],
            'contact_number' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string', 'max:500'],
            'college' => ['sometimes', 'string', 'max:150'],
            'program' => ['sometimes', 'string', 'max:150'],
            'year_level' => ['sometimes', 'integer', 'min:1', 'max:6'],
            'gpa' => ['nullable', 'numeric', 'min:0', 'max:4'],
            // Supervisors and admins keep their employee ID here; students have none.
            'employee_id' => in_array($this->user()?->role, EmployeeId::STAFF_ROLES, true)
                ? ['sometimes', ...EmployeeId::rules($this->user()->id)]
                : ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return EmployeeId::messages();
    }
}
