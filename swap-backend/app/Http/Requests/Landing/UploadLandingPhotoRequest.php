<?php

namespace App\Http\Requests\Landing;

use Illuminate\Foundation\Http\FormRequest;

class UploadLandingPhotoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'photo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
            'caption' => ['required', 'string', 'max:160'],
        ];
    }

    public function messages(): array
    {
        return [
            'photo.max' => 'The photo must be 8 MB or smaller.',
            'photo.mimes' => 'The photo must be a JPG, PNG or WEBP image.',
            'photo.image' => 'The photo must be a JPG, PNG or WEBP image.',
            'caption.required' => 'Add a short caption describing the photo.',
        ];
    }
}
