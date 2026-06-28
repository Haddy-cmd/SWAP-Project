<?php

return [
    // Public URL of the deployed frontend (Vercel). Used to build links in
    // transactional emails such as the password-reset link.
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),

    // Optional Anthropic API key (legacy — the chatbot now uses Gemini below).
    'anthropic_key' => env('ANTHROPIC_API_KEY'),

    // Google Gemini (AI Studio) powers the AI chatbot. Free-tier key from
    // https://aistudio.google.com. When GEMINI_API_KEY is unset, the chatbot
    // falls back to local keyword FAQ matching.
    'gemini_key' => env('GEMINI_API_KEY'),
    'gemini_model' => env('GEMINI_MODEL', 'gemini-2.5-flash'),
];
