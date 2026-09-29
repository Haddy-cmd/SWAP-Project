<?php

namespace App\Http\Requests\Concern;

use App\Models\Concern;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** Admin: move a concern along and/or reply to the student. */
class UpdateConcernRequest extends FormRequest
{
    public const MSG_REPLY_FIRST = 'Write a reply before marking this concern resolved.';

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'string', Rule::in(Concern::STATUSES)],
            'response' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /** A resolved concern must tell the student how: a reply now, or one sent earlier. */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($this->input('status') !== Concern::STATUS_RESOLVED || trim((string) $this->input('response')) !== '') {
                return;
            }

            $concern = Concern::find($this->route('id'));
            if ($concern && empty($concern->response)) {
                $validator->errors()->add('response', self::MSG_REPLY_FIRST);
            }
        });
    }
}
