<?php

namespace App\Http\Requests\Stipend;

use App\Support\StipendUnlock;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Page-level step-up for Stipend Management: the admin re-enters their password
 * once (popup gate) and receives a short-lived unlock token authorizing
 * release/void calls without re-typing the password every time.
 */
class UnlockStipendRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route is behind role:admin
    }

    public function rules(): array
    {
        return [
            'password' => ['required', 'string', StipendUnlock::passwordRule($this->user())],
        ];
    }
}
