<?php

namespace App\Http\Requests\Announcement;

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
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Give the announcement a title.',
            'message.required' => 'Write the announcement message.',
            'message.min' => 'The message must be at least 10 characters.',
            'message.max' => 'The message must be 5,000 characters or fewer.',
        ];
    }
}
