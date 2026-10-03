<?php

namespace App\Http\Requests\Stipend;

use Illuminate\Foundation\Http\FormRequest;

/**
 * A governing supervisor approves or rejects a promissory note. Approval records the
 * lacking hours; if the student renews, they are added to the next term's requirement.
 */
class ReviewPromissoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route is behind role:supervisor; governed-student checked in the service
    }

    public function rules(): array
    {
        return [
            'action' => ['required', 'string', 'in:approve,reject'],
            'lacking_hours' => ['required_if:action,approve', 'nullable', 'numeric', 'min:0.01', 'max:2000'],
            'review_remarks' => ['required_if:action,reject', 'nullable', 'string', 'max:1000'],
        ];
    }
}
