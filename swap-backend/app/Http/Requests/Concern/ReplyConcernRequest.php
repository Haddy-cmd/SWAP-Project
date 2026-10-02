<?php

namespace App\Http\Requests\Concern;

use Illuminate\Foundation\Http\FormRequest;

/** A student adds a follow-up to their own concern thread (no subject — the thread keeps it). */
class ReplyConcernRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'min:2', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'body.required' => 'Type your reply.',
            'body.min' => 'Type your reply.',
        ];
    }
}
