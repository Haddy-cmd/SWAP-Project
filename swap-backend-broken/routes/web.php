<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return ['message' => 'SWAP Backend API'];
});

Route::get('/up', function () {
    return response()->json(['status' => 'ok']);
});
