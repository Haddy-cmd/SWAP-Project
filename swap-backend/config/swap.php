<?php

return [
    // Public URL of the deployed frontend (Vercel). Used to build links in
    // transactional emails such as the password-reset link.
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),

    // Optional Anthropic API key for the AI-assisted chatbot.
    'anthropic_key' => env('ANTHROPIC_API_KEY'),
];
