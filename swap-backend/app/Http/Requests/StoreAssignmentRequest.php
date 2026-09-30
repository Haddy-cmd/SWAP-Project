<?php

namespace App\Http\Requests;

use App\Models\Assignment;
use App\Services\AssignmentService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

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

    /** One active placement per recipient per term (a partial unique index backs this up). */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->hasAny(['user_id', 'academic_year', 'semester'])) {
                return;
            }

            $taken = Assignment::where('user_id', $this->input('user_id'))
                ->where('academic_year', $this->input('academic_year'))
                ->where('semester', $this->input('semester'))
                ->where('status', 'active')
                ->exists();

            if ($taken) {
                $validator->errors()->add('user_id', AssignmentService::MSG_ALREADY_ASSIGNED);
            }
        });
    }
}
