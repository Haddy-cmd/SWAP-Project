<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DecideApplicationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'decision' => ['required', 'string', 'in:approved,rejected'],
            'remarks' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
