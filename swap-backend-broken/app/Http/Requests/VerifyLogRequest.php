<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class VerifyLogRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'action' => ['required', 'string', 'in:verified,rejected'],
            'feedback' => ['required_if:action,rejected', 'nullable', 'string', 'max:1000'],
        ];
    }
}
