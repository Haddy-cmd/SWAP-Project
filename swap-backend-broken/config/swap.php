<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Anthropic API Key
    |--------------------------------------------------------------------------
    | Used by ChatbotService for AI-powered FAQ responses.
    | Leave null to use the keyword-matching fallback only.
    */
    'anthropic_key' => env('ANTHROPIC_API_KEY'),

    /*
    |--------------------------------------------------------------------------
    | QR Code HMAC Secret
    |--------------------------------------------------------------------------
    | Fallback secret for QR token signing. In production the secret is stored
    | per-assignment in the assignments.qr_secret column.
    */
    'qr_secret' => env('QR_SECRET', env('APP_KEY')),

    /*
    |--------------------------------------------------------------------------
    | Stipend Settings
    |--------------------------------------------------------------------------
    */
    'stipend' => [
        'monthly_amount' => env('SWAP_STIPEND_AMOUNT', 1500),
    ],

    /*
    |--------------------------------------------------------------------------
    | Service Hours
    |--------------------------------------------------------------------------
    */
    'required_hours' => env('SWAP_REQUIRED_HOURS', 240),

];
