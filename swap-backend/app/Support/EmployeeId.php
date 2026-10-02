<?php

namespace App\Support;

use Illuminate\Validation\Rule;

/**
 * Staff (supervisors and admins) are identified by their employee ID, the way students
 * are by their student ID. Digits only, unique per account. Entered by the staff member
 * when accepting their invitation, and editable on their Profile.
 */
class EmployeeId
{
    public const STAFF_ROLES = ['supervisor', 'admin'];

    /** @return array<int, mixed> */
    public static function rules(?int $ignoreUserId = null): array
    {
        return [
            'required',
            'string',
            'regex:/^\d{4,15}$/',
            Rule::unique('users', 'employee_id')->ignore($ignoreUserId),
        ];
    }

    /** @return array<string, string> */
    public static function messages(): array
    {
        return [
            'employee_id.required' => 'Enter your employee ID (digits only).',
            'employee_id.regex' => 'Enter your employee ID (digits only).',
            'employee_id.unique' => 'This employee ID is already used by another account.',
            'employee_id.prohibited' => 'Only supervisors and admins have an employee ID.',
        ];
    }
}
