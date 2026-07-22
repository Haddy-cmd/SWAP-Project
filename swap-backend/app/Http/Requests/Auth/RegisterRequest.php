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
            'student_id_number' => ['required', 'string', 'regex:/^\d{9}$/', 'unique:student_profiles,student_id_number'],
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'contact_number' => ['nullable', 'string', 'max:20'],
            'college' => ['required', 'string', 'max:150'],
            'program' => ['required', 'string', 'max:150'],
            // 5th year only exists for the five-year programs (Engineering, BS Accountancy);
            // everyone else caps at 4. The extra cap is enforced in withValidator().
            'year_level' => ['required', 'integer', 'min:1', 'max:5'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if ((int) $this->year_level === 5 && !self::isFiveYearProgram((string) $this->program)) {
                $validator->errors()->add('year_level', 'A 5th year applies only to Engineering and BS Accountancy programs.');
            }
        });
    }

    /** Programs that run a five-year curriculum at MSU Main. */
    public static function isFiveYearProgram(string $program): bool
    {
        return str_contains(strtolower($program), 'engineering')
            || strcasecmp(trim($program), 'BS Accountancy') === 0;
    }

    public function messages(): array
    {
        return [
            'email.regex' => 'Use your institutional email to register',
            'student_id_number.regex' => 'Student ID must be exactly 9 digits.',
        ];
    }
}
