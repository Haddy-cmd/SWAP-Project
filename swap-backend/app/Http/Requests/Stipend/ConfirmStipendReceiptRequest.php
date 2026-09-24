<?php

namespace App\Http\Requests\Stipend;

use Illuminate\Foundation\Http\FormRequest;

class ConfirmStipendReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route is behind role:recipient; ownership checked in the service
    }

    public function rules(): array
    {
        return [
            // No step-up password: the logged-in session is the beneficiary's
            // signature (product decision — receipt is marked without re-auth).
            'releasing_officer_name' => ['required', 'string', 'max:150'],
            'signature_image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'remarks' => ['nullable', 'string', 'max:500'],
        ];
    }
}
