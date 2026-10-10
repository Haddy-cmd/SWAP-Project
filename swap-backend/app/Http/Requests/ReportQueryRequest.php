<?php

namespace App\Http\Requests;

use App\Models\SemesterPeriod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The shape of an Analytics & Reports query. Which columns may be filtered, sorted,
 * grouped or totalled depends on the report, so ReportQuery::fromInput() checks the
 * keys against the dataset's columns after this.
 */
class ReportQueryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'academic_year' => ['nullable', 'string', 'regex:/^\d{4}-\d{4}$/'],
            'semester' => ['nullable', 'string', Rule::in(SemesterPeriod::SEMESTERS)],
            'filters' => ['sometimes', 'array', 'max:20'],
            'filters.*' => ['array', 'max:200'],
            'filters.*.*' => ['nullable', 'string', 'max:255'],
            'search' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'string', 'max:64'],
            'dir' => ['nullable', 'in:asc,desc'],
            'group_by' => ['nullable', 'string', 'max:64'],
            'metric' => ['nullable', 'string', 'max:64'],
            'format' => ['sometimes', 'in:pdf,csv'],
            // PDF only: leave out the graph (the KPI tiles and the table stay).
            'include_chart' => ['sometimes', 'boolean'],
        ];
    }
}
