<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            // "Trust this browser for 30 days" token from an earlier sign-in.
            'device_token' => ['nullable', 'string', 'max:100'],
        ];
    }
}
