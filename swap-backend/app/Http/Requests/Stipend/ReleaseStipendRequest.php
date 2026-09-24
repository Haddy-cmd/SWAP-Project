<?php

namespace App\Http\Requests\Stipend;

use App\Support\StipendUnlock;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Release + certify a claim stub in one step (Option C). Amount defaults to the
 * fixed semester stipend. Authorized by either the step-up password or the
 * page-level unlock token from POST /admin/stipend/unlock — exactly one of them.
 */
class ReleaseStipendRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route is behind role:admin
    }

    public function rules(): array
    {
        return [
            'user_id' => ['required', 'integer', 'exists:users,id'],
            // Optional override; defaults to StipendService::DEFAULT_STIPEND_AMOUNT (₱5,000).
            'amount' => ['nullable', 'numeric', 'min:0.01'],
            'academic_year' => ['required', 'string'],
            'semester' => ['required', 'string'],
            'period_label' => ['nullable', 'string', 'max:100'],
            'remarks' => ['nullable', 'string', 'max:500'],
            // Step-up: re-enter the current password to authorize a money-critical action.
            'password' => ['required_without:unlock_token', 'string', StipendUnlock::passwordRule($this->user())],
            // Alternative: the page-level unlock token (one password entry per visit).
            'unlock_token' => ['required_without:password', 'string', StipendUnlock::tokenRule($this->user())],
            'signature_image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ];
    }
}
