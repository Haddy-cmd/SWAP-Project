<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreNarrativeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'content' => ['required', 'string', 'min:50', 'max:5000'],
            'activities_done' => ['required', 'string', 'min:20', 'max:3000'],
            'challenges' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
