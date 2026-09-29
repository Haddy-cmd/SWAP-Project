<?php

namespace App\Http\Requests\Orientation;

use Illuminate\Foundation\Http\FormRequest;

/** Invite the ticked applicants, or (no user_ids) every one not yet invited. */
class InviteOrientationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'user_ids' => ['nullable', 'array', 'min:1', 'max:500'],
            'user_ids.*' => ['integer', 'distinct'],
        ];
    }
}
