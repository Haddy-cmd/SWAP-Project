<?php

namespace App\Http\Requests\Stipend;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Hash;

class ConfirmStipendReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route is behind role:recipient; ownership checked in the service
    }

    public function rules(): array
    {
        return [
            // Step-up: the beneficiary re-enters their password to sign for the money.
            'password' => ['required', 'string', $this->currentPasswordRule()],
            'releasing_officer_name' => ['required', 'string', 'max:150'],
            'signature_image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'remarks' => ['nullable', 'string', 'max:500'],
        ];
    }

    private function currentPasswordRule(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail): void {
            if (!Hash::check((string) $value, (string) $this->user()->password)) {
                $fail('The password you entered is incorrect.');
            }
        };
    }
}
