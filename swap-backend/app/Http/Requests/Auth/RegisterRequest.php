<?php

namespace App\Http\Requests\Auth;

use App\Support\PasswordPolicy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
        $first = self::nameCase(self::normalizeName($this->input('first_name')));
        $middle = self::nameCase(self::normalizeName($this->input('middle_name')));
        $last = self::nameCase(self::normalizeName($this->input('last_name')));

        $this->merge(array_filter([
            'first_name' => $first,
            'middle_name' => $middle,
            'last_name' => $last,
            // Built from the parts, whatever the request sent.
            'name' => self::fullName($first, $middle, $last),
            'email' => is_string($this->input('email')) ? strtolower(trim($this->input('email'))) : null,
        ], fn ($value) => $value !== null));
    }

    public function rules(): array
    {
        // Character rules shared by every name field; the length cap differs.
        $nameChars = ['string', 'regex:' . self::NAME_REGEX];
        $nameRules = array_merge($nameChars, ['max:100']);

        return [
            // Built in prepareForValidation(); first and last name are required.
            'name' => array_merge(['nullable'], $nameChars, ['max:255']),
            'email' => [
                'required',
                'email',
                'max:255',
                'ends_with:' . self::EMAIL_DOMAIN,
                // Soft-deleted accounts keep their row; only live ones own an address.
                Rule::unique('users', 'email')->whereNull('deleted_at'),
            ],
            'password' => ['required', 'confirmed', PasswordPolicy::rule()],
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
            // 5th year only exists for the five-year programs (FIVE_YEAR_PROGRAMS);
            // everyone else caps at 4. The extra cap is enforced in withValidator().
            'year_level' => ['required', 'integer', 'min:1', 'max:5'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if ((int) $this->year_level === 5 && !self::isFiveYearProgram((string) $this->program)) {
                $validator->errors()->add('year_level', self::MSG_NOT_FIVE_YEAR);
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

    /**
     * Name case: the first letter of each word — and after a hyphen, apostrophe or
     * period ("Mary-Ann", "O'Brien", "Ma. Clara") — uppercase, the rest lowercase,
     * so "NORODIN" and "norodin" are both saved as "Norodin". Mirrors the register form.
     */
    public static function nameCase(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return preg_replace_callback(
            "/(^|[\s\-'.])(\p{Ll})/u",
            fn (array $m) => $m[1] . mb_strtoupper($m[2]),
            mb_strtolower($value)
        ) ?? $value;
    }

    /**
     * Full Name (as per records): first name, middle initial(s), last name — "Juan A.
     * Dela Cruz"; a two-word middle name gives "D. C.". Never taken from the request.
     * Mirrors fullNameFrom on the register form.
     */
    public static function fullName(?string $first, ?string $middle, ?string $last): ?string
    {
        $initials = implode(' ', array_map(
            fn (string $word) => mb_strtoupper(mb_substr($word, 0, 1)) . '.',
            preg_split('/\s+/u', (string) $middle, -1, PREG_SPLIT_NO_EMPTY) ?: []
        ));
        $full = implode(' ', array_filter([$first, $initials, $last], fn ($p) => $p !== null && $p !== ''));

        return $full === '' ? null : $full;
    }

    public const MSG_NOT_FIVE_YEAR = 'A 5th year applies only to College of Engineering programs and BS Accountancy.';

    /**
     * Programs that run a five-year curriculum at MSU Main: the College of Engineering's and
     * BS Accountancy (official masterlist AY 2025–2026). Same list as the registration page.
     * BSET programs (Division of Engineering Technology) run four years.
     */
    public const FIVE_YEAR_PROGRAMS = [
        'BS Agricultural and Biosystems Engineering',
        'BS Chemical Engineering',
        'BS Civil Engineering',
        'BS Civil Engineering (Structural)',
        'BS Electrical Engineering',
        'BS Electronics Engineering',
        'BS Mechanical Engineering',
        'BS Accountancy',
    ];

    public static function isFiveYearProgram(string $program): bool
    {
        $wanted = strtolower(trim($program));

        return in_array($wanted, array_map('strtolower', self::FIVE_YEAR_PROGRAMS), true);
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
        ] + PasswordPolicy::messages();
    }
}
