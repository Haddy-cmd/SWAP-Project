<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    | The frontend authenticates with Bearer tokens (no cookies), so
    | credentialed requests are not needed. We only allow the deployed
    | frontend origin (FRONTEND_URL) plus localhost for development.
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter([
        env('FRONTEND_URL'),
        'http://localhost:3000',
    ])),

    'allowed_origins_patterns' => [
        // Allow this project's Vercel deployments (production + preview URLs),
        // so CORS works even if FRONTEND_URL is unset/misconfigured.
        '#^https://swap-project.*\.vercel\.app$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
