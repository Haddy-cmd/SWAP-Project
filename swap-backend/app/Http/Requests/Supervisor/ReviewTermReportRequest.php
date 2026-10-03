<?php

namespace App\Http\Requests\Supervisor;

use Illuminate\Foundation\Http\FormRequest;

/** The supervisor accepts an end-of-term report: eligible or not for renewal, with optional remarks. */
class ReviewTermReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route is behind role:supervisor; governance is checked in the service
    }

    public function rules(): array
    {
        return [
            'renewal_eligible' => ['required', 'boolean'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'renewal_eligible.required' => 'Choose whether the student is eligible for renewal.',
        ];
    }
}
