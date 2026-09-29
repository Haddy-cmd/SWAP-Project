<?php

namespace App\Http\Requests\Stipend;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The Banking Office confirming a payout (public, token-gated). Only the PIN: the
 * releasing officer's name comes from the admin's setup (BankingOfficePin).
 */
class ReleaseAtBankingOfficeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'pin' => ['required', 'string', 'max:20'],
        ];
    }

    public function messages(): array
    {
        return [
            'pin.required' => 'Enter the Banking Office PIN.',
        ];
    }
}
