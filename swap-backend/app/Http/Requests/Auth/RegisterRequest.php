<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    /** Only MSU Main Campus student addresses may register. */
    public const EMAIL_DOMAIN = '@s.msumain.edu.ph';

    /** Letters (incl. ñ/Ñ and accented forms), spaces, hyphens, apostrophes, periods. */
    private const NAME_REGEX = "/^[\p{L}\p{M}\-'. ]+$/u";

    public function authorize(): bool
    {
        return true;
    }

    /**
     * Normalize before the rules run so trailing spaces and double spaces are never
     * the reason a name is rejected — and so the full-name comparison below comes
     * out the same on the server as it did in the browser.
     */
    protected function prepareForValidation(): void
    {
        $this->merge(array_filter([
            'first_name' => self::normalizeName($this->input('first_name')),
            'middle_name' => self::normalizeName($this->input('middle_name')),
            'last_name' => self::normalizeName($this->input('last_name')),
            'name' => self::normalizeName($this->input('name')),
            'email' => is_string($this->input('email')) ? strtolower(trim($this->input('email'))) : null,
        ], fn ($value) => $value !== null));
    }

    public function rules(): array
    {
        // Character rules shared by every name field; the length cap differs.
        $nameChars = ['string', 'regex:' . self::NAME_REGEX];
        $nameRules = array_merge($nameChars, ['max:100']);

        return [
            'name' => array_merge(['required'], $nameChars, ['max:255']),
            'email' => [
                'required',
                'email',
                'max:255',
                'ends_with:' . self::EMAIL_DOMAIN,
                // Soft-deleted accounts keep their row; only live ones own an address.
                Rule::unique('users', 'email')->whereNull('deleted_at'),
            ],
            'password' => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()],
            'student_id_number' => [
                'required',
                'string',
                'regex:/^\d{9}$/',
                Rule::unique('student_profiles', 'student_id_number')->whereNull('deleted_at'),
            ],
            'first_name' => array_merge(['required'], $nameRules),
            'middle_name' => array_merge(['nullable'], $nameRules),
            'last_name' => array_merge(['required'], $nameRules),
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

            // "Full Name (as per records)" must be the parts joined by single spaces.
            // Skip it when a part is already invalid — one error per problem.
            if ($validator->errors()->hasAny(['first_name', 'middle_name', 'last_name', 'name'])) {
                return;
            }

            $expected = self::expectedFullName(
                (string) $this->first_name,
                $this->middle_name,
                (string) $this->last_name
            );

            if (mb_strtolower($expected) !== mb_strtolower((string) $this->name)) {
                $validator->errors()->add('name', 'Full name must match your first, middle, and last name.');
            }
        });
    }

    /** Trim, then collapse every run of whitespace to one space. */
    public static function normalizeName(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        return trim(preg_replace('/\s+/u', ' ', $value) ?? '');
    }

    /** First + (Middle, if given) + Last, single-spaced. */
    public static function expectedFullName(string $first, ?string $middle, string $last): string
    {
        return implode(' ', array_filter([$first, $middle, $last], fn ($p) => $p !== null && $p !== ''));
    }

    /** Programs that run a five-year curriculum at MSU Main. */
    public static function isFiveYearProgram(string $program): bool
    {
        return str_contains(strtolower($program), 'engineering')
            || strcasecmp(trim($program), 'BS Accountancy') === 0;
    }

    public function messages(): array
    {
        $nameMessage = 'Use letters, spaces, hyphens, apostrophes and periods only.';

        return [
            'email.ends_with' => 'Please use your MSU-Main student email (' . self::EMAIL_DOMAIN . ').',
            'student_id_number.regex' => 'Student ID must be exactly 9 digits.',
            'first_name.regex' => $nameMessage,
            'middle_name.regex' => $nameMessage,
            'last_name.regex' => $nameMessage,
            'name.regex' => $nameMessage,
        ];
    }
}
