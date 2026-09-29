<?php

namespace App\Http\Requests\Stipend;

use App\Support\BankingOfficePin;
use App\Support\StipendUnlock;
use Illuminate\Foundation\Http\FormRequest;

/** The releasing officer's name + PIN. The PIN may be left blank to keep the current one. */
class SetBankingOfficePinRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // route is behind role:admin
    }

    public function rules(): array
    {
        return [
            'officer_name' => ['required', 'string', 'max:150'],
            // Required the first time; afterwards blank keeps the current PIN.
            'pin' => [BankingOfficePin::hasPin() ? 'nullable' : 'required', 'digits_between:6,8', 'confirmed'],
            // The PIN authorises payouts, so changing it needs the same step-up as
            // releasing a stub: the admin's password or the page unlock token.
            'password' => ['required_without:unlock_token', 'string', StipendUnlock::passwordRule($this->user())],
            'unlock_token' => ['required_without:password', 'string', StipendUnlock::tokenRule($this->user())],
        ];
    }

    public function messages(): array
    {
        return [
            'officer_name.required' => "Enter the releasing officer's name.",
            'pin.required' => 'Enter a PIN for the releasing officer.',
            'pin.digits_between' => 'The Banking Office PIN must be 6 to 8 digits.',
            'pin.confirmed' => 'The two PIN entries do not match.',
        ];
    }
}
