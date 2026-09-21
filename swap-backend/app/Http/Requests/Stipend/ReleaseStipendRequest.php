<?php

namespace App\Http\Requests\Stipend;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Hash;

/**
 * Release + certify a claim stub in one step (Option C). Amount defaults to the
 * fixed semester stipend; the admin re-enters their password (step-up) to
 * authorize the payout.
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
            'password' => ['required', 'string', $this->currentPasswordRule()],
            'signature_image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ];
    }

    /** Sanctum is stateless, so verify the password against the bound user directly. */
    private function currentPasswordRule(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail): void {
            if (!Hash::check((string) $value, (string) $this->user()->password)) {
                $fail('The password you entered is incorrect.');
            }
        };
    }
}
