<?php

namespace App\Http\Requests\TermReport;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The report is typed (content) or uploaded (PDF/Word file) — either counts. An earlier
 * upload is kept unless a new file replaces it or remove_file is sent; the service checks
 * that text or a file remains.
 */
class SaveTermReportRequest extends FormRequest
{
    public const MSG_EMPTY = 'Write your report or upload it as a PDF/Word file.';

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'content' => ['nullable', 'string', 'min:50', 'max:5000'],
            'file' => ['nullable', 'file', 'mimes:pdf,doc,docx', 'max:5120'],
            'remove_file' => ['nullable', 'boolean'],
            'accomplishments' => ['nullable', 'string', 'max:3000'],
            'challenges' => ['nullable', 'string', 'max:3000'],
        ];
    }

    public function messages(): array
    {
        return [
            'content.min' => 'Your report must be at least 50 characters.',
            'content.max' => 'Your report must be 5,000 characters or fewer.',
            'file.uploaded' => 'The file couldn\'t be uploaded. Use a PDF or Word file of up to 5 MB.',
            'file.mimes' => 'Upload the report as a PDF or Word file (.pdf, .doc, .docx).',
            'file.max' => 'The file must be 5 MB or smaller.',
        ];
    }
}
