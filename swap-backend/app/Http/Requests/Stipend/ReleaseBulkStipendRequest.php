<?php

namespace App\Http\Requests\Stipend;

use App\Support\StipendUnlock;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Bulk release of claim stubs from the eligible checklist. Authorized by the
 * page-level unlock token (no per-release password); each item follows the same
 * single-release rules and failures never abort the batch.
 */
class ReleaseBulkStipendRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route is behind role:admin
    }

    public function rules(): array
    {
        return [
            'unlock_token' => ['required', 'string', StipendUnlock::tokenRule($this->user())],
            // Bounded so one request can't stack unbounded PDF renders + mails
            // onto the sync queue (QUEUE_CONNECTION=sync runs them inline).
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.user_id' => ['required', 'integer', 'exists:users,id'],
            'items.*.amount' => ['nullable', 'numeric', 'min:0.01'],
            'items.*.academic_year' => ['required', 'string'],
            'items.*.semester' => ['required', 'string'],
            'items.*.period_label' => ['nullable', 'string', 'max:100'],
            'items.*.remarks' => ['nullable', 'string', 'max:500'],
        ];
    }
}
