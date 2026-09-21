<?php

namespace App\Http\Requests\Stipend;

use Illuminate\Foundation\Http\FormRequest;

class VoidStipendRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route is behind role:admin
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'max:500'],
        ];
    }
}
