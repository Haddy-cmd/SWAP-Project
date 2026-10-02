<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreApplicationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** Nothing to choose: the term is the current semester, set by the server. */
    public function rules(): array
    {
        return [];
    }
}
