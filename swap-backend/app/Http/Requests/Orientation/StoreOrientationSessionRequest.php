<?php

namespace App\Http\Requests\Orientation;

use Illuminate\Foundation\Http\FormRequest;

/** Create or edit an orientation session (PUT sends the full form too). */
class StoreOrientationSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:150'],
            // Editing a past session (e.g. fixing its title) stays allowed; a new
            // one must be in the future.
            'scheduled_at' => $this->isMethod('post') ? ['required', 'date', 'after:now'] : ['required', 'date'],
            'mode' => ['required', 'string', 'in:in_person,online'],
            'location' => ['nullable', 'string', 'max:255', 'required_if:mode,in_person'],
            'meeting_link' => ['nullable', 'url', 'max:500', 'required_if:mode,online'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Give the session a title.',
            'scheduled_at.after' => 'Pick a date and time in the future.',
            'location.required_if' => 'An in-person orientation needs a venue.',
            'meeting_link.required_if' => 'An online orientation needs a meeting link.',
            'meeting_link.url' => 'Enter a valid meeting link, including https://.',
        ];
    }
}
