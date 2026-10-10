<?php

namespace App\Http\Requests;

use App\Support\Colleges;
use App\Support\EmployeeId;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** "0917 123 4567" and "0917-123-4567" are stored as 09171234567. */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('contact_number'))) {
            $this->merge(['contact_number' => preg_replace('/[\s\-]/', '', $this->input('contact_number')) ?: null]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'position_title' => ['nullable', 'string', 'max:150'],
            // Same check (and words) as the Profile page.
            'contact_number' => ['nullable', 'string', 'regex:/^09\d{9}$/'],
            'address' => ['nullable', 'string', 'max:500'],
            // The official list; the program must belong to the (new or saved) college.
            'college' => ['sometimes', 'string', Rule::in(Colleges::codes())],
            'program' => ['sometimes', 'string', Rule::in(Colleges::programsOf($this->input('college') ?? $this->user()?->profile?->college))],
            'year_level' => ['sometimes', 'integer', 'min:1', 'max:6'],
            'gpa' => ['nullable', 'numeric', 'min:0', 'max:4'],
            // Supervisors and admins keep their employee ID here; students have none.
            'employee_id' => in_array($this->user()?->role, EmployeeId::STAFF_ROLES, true)
                ? ['sometimes', ...EmployeeId::rules($this->user()->id)]
                : ['prohibited'],
        ];
    }

    /** Changing only the college: the saved program must still be one of its programs. */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if ($this->has('college') && !$this->has('program')
                && !in_array($this->user()?->profile?->program, Colleges::programsOf($this->input('college')), true)) {
                $validator->errors()->add('program', Colleges::MSG_PROGRAM);
            }
        });
    }

    public function messages(): array
    {
        return EmployeeId::messages() + [
            'contact_number.regex' => 'Use 11 digits, e.g. 0917 123 4567.',
            'college.in' => Colleges::MSG_COLLEGE,
            'program.in' => Colleges::MSG_PROGRAM,
        ];
    }
}
