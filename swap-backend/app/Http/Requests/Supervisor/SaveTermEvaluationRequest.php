<?php

namespace App\Http\Requests\Supervisor;

use Illuminate\Foundation\Http\FormRequest;

/** The supervisor's end-of-term evaluation: a 1–5 rating with remarks (TermEvaluationService). */
class SaveTermEvaluationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route is behind role:supervisor; governance is checked in the service
    }

    public function rules(): array
    {
        return [
            'rating' => ['required', 'integer', 'between:1,5'],
            'remarks' => ['required', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'rating.required' => 'Choose a rating from 1 to 5.',
            'rating.between' => 'Choose a rating from 1 to 5.',
            'remarks.required' => 'Add remarks about the student’s service this term.',
        ];
    }
}
