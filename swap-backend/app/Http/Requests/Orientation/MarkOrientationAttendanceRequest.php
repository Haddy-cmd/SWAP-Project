<?php

namespace App\Http\Requests\Orientation;

use App\Models\OrientationAttendee;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MarkOrientationAttendanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'user_id' => ['required', 'integer', Rule::exists('users', 'id')->where('role', 'applicant')],
            'status' => ['required', 'string', Rule::in(OrientationAttendee::STATUSES)],
        ];
    }

    public function messages(): array
    {
        return [
            'user_id.exists' => 'Attendance can only be recorded for applicants.',
        ];
    }
}
