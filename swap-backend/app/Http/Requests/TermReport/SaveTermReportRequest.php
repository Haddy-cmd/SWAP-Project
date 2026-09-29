<?php

namespace App\Http\Requests\TermReport;

use Illuminate\Foundation\Http\FormRequest;

class SaveTermReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'content' => ['required', 'string', 'min:100', 'max:5000'],
            'accomplishments' => ['nullable', 'string', 'max:3000'],
            'challenges' => ['nullable', 'string', 'max:3000'],
        ];
    }

    public function messages(): array
    {
        return [
            'content.required' => 'Write your end-of-term narrative report.',
            'content.min' => 'Your report must be at least 100 characters.',
            'content.max' => 'Your report must be 5,000 characters or fewer.',
        ];
    }
}
