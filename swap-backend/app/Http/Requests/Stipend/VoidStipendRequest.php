<?php

namespace App\Http\Requests\Stipend;

use App\Support\StipendUnlock;
use Illuminate\Foundation\Http\FormRequest;

class VoidStipendRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route is behind role:admin
    }

    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'max:500'],
            // Voiding destroys a certified claim, so it stays behind the same
            // step-up as release: password or page-level unlock token.
            'password' => ['required_without:unlock_token', 'string', StipendUnlock::passwordRule($this->user())],
            'unlock_token' => ['required_without:password', 'string', StipendUnlock::tokenRule($this->user())],
        ];
    }
}
