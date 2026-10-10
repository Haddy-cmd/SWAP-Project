<?php

namespace App\Http\Requests\Analytics;

use Illuminate\Foundation\Http\FormRequest;

/** Admin → Analytics → Supervisors: remind the busy supervisors of one term. */
class RemindSupervisorsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // the admin route group checks the role
    }

    public function rules(): array
    {
        return [
            'academic_year' => ['required', 'string', 'max:20'],
            'semester' => ['required', 'string', 'max:30'],
        ];
    }
}
