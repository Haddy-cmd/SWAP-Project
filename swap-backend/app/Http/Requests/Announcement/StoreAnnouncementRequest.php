<?php

namespace App\Http\Requests\Announcement;

use App\Services\AnnouncementService;
use Illuminate\Foundation\Http\FormRequest;

class StoreAnnouncementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route is behind role:admin
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:150'],
            'message' => ['required', 'string', 'min:10', 'max:5000'],
            // Photos and documents: shown in the portal, listed (not attached) in the email.
            'attachments' => ['sometimes', 'array', 'max:' . AnnouncementService::MAX_FILES],
            'attachments.*' => ['file', 'max:' . AnnouncementService::MAX_FILE_KB, 'mimes:' . implode(',', AnnouncementService::FILE_TYPES)],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Give the announcement a title.',
            'message.required' => 'Write the announcement message.',
            'message.min' => 'The message must be at least 10 characters.',
            'message.max' => 'The message must be 5,000 characters or fewer.',
            'attachments.max' => AnnouncementService::MSG_TOO_MANY_FILES,
            'attachments.*.file' => AnnouncementService::MSG_FILE_TYPE,
            'attachments.*.mimes' => AnnouncementService::MSG_FILE_TYPE,
        ];
    }

    /** "{file} is over 10 MB." names the file, so it is built per upload. */
    public function withValidator($validator): void
    {
        $validator->after(function ($v) {
            foreach ((array) $this->file('attachments', []) as $i => $file) {
                if ($v->errors()->has("attachments.{$i}") && $file && $file->getSize() > AnnouncementService::MAX_FILE_KB * 1024) {
                    $v->errors()->forget("attachments.{$i}");
                    $v->errors()->add("attachments.{$i}", sprintf(AnnouncementService::MSG_FILE_TOO_BIG, $file->getClientOriginalName()));
                }
            }
        });
    }
}
