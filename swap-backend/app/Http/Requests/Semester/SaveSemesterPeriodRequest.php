<?php

namespace App\Http\Requests\Semester;

use App\Models\SemesterPeriod;
use App\Services\SemesterPeriodService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Create or edit a semester period (PUT sends the whole form). Year + semester are
 * unique, and no two periods' dates may overlap — so "the current semester" is
 * always exactly one or none.
 */
class SaveSemesterPeriodRequest extends FormRequest
{
    public const MSG_RENEWAL_ENDED = "Renewal can only be opened for a semester that hasn't ended.";

    public function authorize(): bool
    {
        return true; // route is behind role:admin
    }

    private function periodId(): ?int
    {
        $id = $this->route('id');

        return $id !== null ? (int) $id : null;
    }

    public function rules(): array
    {
        return [
            'academic_year' => ['required', 'string', 'regex:/^\d{4}-\d{4}$/'],
            'semester' => [
                'required', 'string', Rule::in(SemesterPeriod::SEMESTERS),
                Rule::unique('semester_periods', 'semester')
                    ->where('academic_year', (string) $this->input('academic_year'))
                    ->ignore($this->periodId()),
            ],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'renewal_open' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'academic_year.regex' => 'Enter the school year as two years, e.g. 2026-2027.',
            'semester.in' => 'Choose 1st Semester, 2nd Semester or Summer.',
            'semester.unique' => 'This semester of that school year is already set up.',
            'end_date.after' => 'The end date must be after the start date.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            [$first, $second] = array_map('intval', explode('-', (string) $this->input('academic_year')));
            if ($second !== $first + 1) {
                $validator->errors()->add('academic_year', 'The school year must be two consecutive years, e.g. 2026-2027.');

                return;
            }

            $start = Carbon::parse($this->input('start_date'))->toDateString();
            $end = Carbon::parse($this->input('end_date'))->toDateString();
            $clash = SemesterPeriod::where('start_date', '<=', $end)
                ->where('end_date', '>=', $start)
                ->when($this->periodId(), fn ($q, $id) => $q->where('id', '!=', $id))
                ->orderBy('start_date')
                ->first();

            if ($clash) {
                $validator->errors()->add('start_date', sprintf(
                    'These dates overlap %s (%s to %s).',
                    $clash->label(),
                    $clash->start_date->format('M j, Y'),
                    $clash->end_date->format('M j, Y'),
                ));
            }

            // Renewal targets a term recipients will serve in, not one that is over.
            if ($this->boolean('renewal_open') && $end < SemesterPeriodService::today()->toDateString()) {
                $validator->errors()->add('renewal_open', self::MSG_RENEWAL_ENDED);
            }
        });
    }
}
