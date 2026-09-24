<?php

namespace App\Http\Requests\Stipend;

use Illuminate\Foundation\Http\FormRequest;

/**
 * A recipient short on hours after the semester end uploads a promissory note
 * asking to render the lacking hours ASAP. Semester-end + shortfall + no pending
 * note are enforced in PromissoryService (they need DB reads, not just input shape).
 */
class SubmitPromissoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route is behind role:recipient; ownership checked in the service
    }

    public function rules(): array
    {
        return [
            'assignment_id' => ['required', 'integer', 'exists:assignments,id'],
            // Same limits as application documents (DocumentController).
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'reason' => ['required', 'string', 'max:2000'],
        ];
    }
}
