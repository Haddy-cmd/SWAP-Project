<?php

namespace App\Http\Requests\Audit;

use App\Services\AuditLogService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Admin → Audit Logs filters (AuditLogService::query). */
class AuditLogQueryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:admin middleware
    }

    public function rules(): array
    {
        return [
            'area' => ['nullable', Rule::in(array_keys(AuditLogService::AREAS))],
            'actor_id' => ['nullable', 'integer'],
            'subject' => ['nullable', 'string', 'max:100'],
            'subject_user_id' => ['nullable', 'integer'],
            'record' => ['nullable', 'string', 'regex:/^(' . implode('|', array_keys(AuditLogService::RECORD_TYPES)) . '):\d+$/'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'sensitive' => ['nullable', 'boolean'],
            'include_testing' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return ['record.regex' => 'Unknown record.', 'to.after_or_equal' => 'The end date must be on or after the start date.'];
    }
}
