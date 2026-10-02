<?php

namespace App\Http\Requests\Supervisor;

use Illuminate\Foundation\Http\FormRequest;

/** A supervisor marks a student's current term deficient (TermStatusService::markDeficient). */
class MarkDeficientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route is behind role:supervisor; governance is checked in the service
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'min:10', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.required' => 'Give the reason this term is deficient.',
            'reason.min' => 'The reason must be at least 10 characters.',
        ];
    }
}
