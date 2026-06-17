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
            'time_log_id' => ['required', 'integer', 'exists:time_logs,id'],
            'content' => ['required', 'string', 'min:10', 'max:5000'],
            'activities_done' => ['required', 'string', 'min:10', 'max:3000'],
            'challenges' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
