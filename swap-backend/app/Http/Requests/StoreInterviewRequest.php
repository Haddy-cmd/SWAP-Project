<?php

namespace App\Http\Requests;

use App\Support\InterviewWindow;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

class StoreInterviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Normalize the instant before anything else touches it. Laravel stores a
     * datetime string using whatever wall clock it carries, so an offset like
     * +08:00 would otherwise be saved as 14:00 UTC instead of 06:00 UTC. A
     * string with no offset at all is read as Manila time, because that is the
     * zone every scheduling rule here is written in.
     */
    protected function prepareForValidation(): void
    {
        $raw = $this->input('scheduled_at');

        if (!is_string($raw) || $raw === '') {
            return;
        }

        try {
            $this->merge([
                'scheduled_at' => Carbon::parse($raw, InterviewWindow::TIMEZONE)->utc()->format('Y-m-d H:i:s'),
            ]);
        } catch (\Throwable) {
            // Leave it alone; the `date` rule will reject it with a clear message.
        }
    }

    public function rules(): array
    {
        return [
            // The window rules below re-check "not in the past" in Manila time;
            // `after:now` only guards against a wildly stale payload.
            'scheduled_at' => ['required', 'date', 'after:now'],
            'duration_minutes' => ['nullable', 'integer', 'min:15', 'max:180'],
            'location' => ['nullable', 'string', 'max:255'],
            'mode' => ['required', 'string', 'in:in_person,online'],
            'meeting_link' => [
                'nullable',
                'url',
                'max:500',
                // An online interview is useless without somewhere to join it.
                'required_if:mode,online',
            ],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            // Only worth checking once the basics parsed.
            if ($validator->errors()->hasAny(['scheduled_at', 'mode'])) {
                return;
            }

            $start = Carbon::parse($this->input('scheduled_at'))->setTimezone(InterviewWindow::TIMEZONE);

            foreach (InterviewWindow::violations($start, (string) $this->input('mode'), $this->durationMinutes()) as $message) {
                $validator->errors()->add('scheduled_at', $message);
            }
        });
    }

    public function durationMinutes(): int
    {
        return (int) ($this->input('duration_minutes') ?: 30);
    }

    public function messages(): array
    {
        return [
            'meeting_link.required_if' => 'An online interview needs a meeting link.',
            'meeting_link.url' => 'Enter a valid meeting link, including https://.',
        ];
    }
}
