<?php

use Illuminate\Support\Facades\Route;

// This service is the JSON API only (the portal UI is the Next.js app); the root
// just identifies it. Health checks use /up.
Route::get('/', fn () => response()->json(['name' => 'SWAP Portal API']));
