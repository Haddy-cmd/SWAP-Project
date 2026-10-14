<?php

return [
    // Public URL of the deployed frontend (Vercel). Used to build links in
    // transactional emails such as the password-reset link.
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),

    // Google Gemini (AI Studio) powers the AI chatbot. Free-tier key from
    // https://aistudio.google.com. When GEMINI_API_KEY is unset, the chatbot
    // falls back to local keyword FAQ matching.
    'gemini_key' => env('GEMINI_API_KEY'),
    'gemini_model' => env('GEMINI_MODEL', 'gemini-2.5-flash'),

    // Admin → System Testing, switched on and off only here (live and local; no switch in the
    // app). Defaults to off with APP_ENV=production, on elsewhere. When off, its sidebar item,
    // page and API are gone, no rule is bypassed, and `php artisan testing:shutdown` (run by
    // start.sh on every boot) restores any account still in testing to how it was when picked.
    'test_tools' => (bool) env('SWAP_TEST_TOOLS', env('APP_ENV', 'production') !== 'production'),
];
