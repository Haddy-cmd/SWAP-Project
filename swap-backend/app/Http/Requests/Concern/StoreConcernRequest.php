<?php

namespace App\Http\Requests\Concern;

use Illuminate\Foundation\Http\FormRequest;

class StoreConcernRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'subject' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'min:10', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'subject.required' => 'Add a short subject.',
            'message.required' => 'Describe your concern.',
            'message.min' => 'Please describe your concern in at least 10 characters.',
        ];
    }
}
