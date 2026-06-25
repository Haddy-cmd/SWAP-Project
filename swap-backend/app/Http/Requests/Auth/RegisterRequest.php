<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            // Only MSU Main Campus student emails may register.
            'email' => ['required', 'email', 'max:255', 'regex:/@s\.msumain\.edu\.ph$/i', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()],
            'student_id_number' => ['required', 'string', 'max:50', 'unique:student_profiles,student_id_number'],
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'contact_number' => ['nullable', 'string', 'max:20'],
            'college' => ['required', 'string', 'max:150'],
            'program' => ['required', 'string', 'max:150'],
            'year_level' => ['required', 'integer', 'min:1', 'max:6'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.regex' => 'Use your institutional email to register',
        ];
    }
}
