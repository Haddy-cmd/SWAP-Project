<?php

namespace App\Http\Requests;

use App\Support\RejectionReasons;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DecideApplicationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $rejecting = $this->input('decision') === 'rejected';

        return [
            'decision' => ['required', 'string', 'in:approved,rejected'],
            // Rejecting needs a reason category; "Other" also needs a written explanation.
            'rejection_reason' => $rejecting
                ? ['required', 'string', Rule::in(RejectionReasons::keys())]
                : ['nullable'],
            'remarks' => $rejecting && $this->input('rejection_reason') === 'other'
                ? ['required', 'string', 'min:' . RejectionReasons::NOTE_MIN, 'max:1000']
                : ['nullable', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'rejection_reason.required' => RejectionReasons::MSG_REASON_REQUIRED,
            'rejection_reason.in' => RejectionReasons::MSG_REASON_REQUIRED,
            'remarks.required' => RejectionReasons::MSG_NOTE_REQUIRED,
            'remarks.min' => RejectionReasons::MSG_NOTE_REQUIRED,
        ];
    }
}
