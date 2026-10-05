<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The clock-out note. Its Task Description (`content`) is required to clock out and
 * prints on the duty slip; the specific activities and challenges are optional.
 */
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
            'activities_done' => ['nullable', 'string', 'max:3000'],
            'challenges' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function attributes(): array
    {
        return [
            'content' => 'task description',
            'activities_done' => 'specific activities',
        ];
    }
}
