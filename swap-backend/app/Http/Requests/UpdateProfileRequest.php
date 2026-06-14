<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'contact_number' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string', 'max:500'],
            'college' => ['sometimes', 'string', 'max:150'],
            'program' => ['sometimes', 'string', 'max:150'],
            'year_level' => ['sometimes', 'integer', 'min:1', 'max:6'],
            'gpa' => ['nullable', 'numeric', 'min:0', 'max:4'],
        ];
    }
}
