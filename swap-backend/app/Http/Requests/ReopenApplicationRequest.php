<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReopenApplicationRequest extends FormRequest
{
    public const MSG_REASON = 'Explain why this application is being reopened (at least 10 characters).';

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'min:10', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.required' => self::MSG_REASON,
            'reason.min' => self::MSG_REASON,
        ];
    }
}
