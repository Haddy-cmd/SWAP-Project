<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreInterviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'scheduled_at' => ['required', 'date', 'after:now'],
            'location' => ['nullable', 'string', 'max:255'],
            'mode' => ['required', 'string', 'in:in_person,online'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
