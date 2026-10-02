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
            // Optional: the document carries the explanation (the form no longer asks).
            'reason' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /** Same wording as the Stipend page's own check (5 MB, PDF/JPG/PNG). */
    public function messages(): array
    {
        return [
            'file.required' => 'Attach your promissory note (PDF, JPG or PNG, up to 5 MB).',
            'file.uploaded' => 'The file couldn\'t be uploaded. Use a PDF, JPG or PNG of up to 5 MB.',
            'file.mimes' => 'Upload the promissory note as a PDF, JPG or PNG.',
            'file.max' => 'The file must be 5 MB or smaller.',
        ];
    }
}
