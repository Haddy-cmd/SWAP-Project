<?php

namespace App\Http\Requests\Stipend;

use Illuminate\Foundation\Http\FormRequest;

/** Admin → Stipend → "Can't release yet" → Remind (some recipients, or all blocked when omitted). */
class RemindStipendRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // the admin route group checks the role
    }

    public function rules(): array
    {
        return [
            'user_ids' => ['sometimes', 'array', 'max:200'],
            'user_ids.*' => ['integer'],
        ];
    }
}
