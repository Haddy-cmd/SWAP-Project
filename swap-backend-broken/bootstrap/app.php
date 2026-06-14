<?php

use Illuminate\Foundation\Application;
use App\Providers\AppServiceProvider;
use App\Providers\EventServiceProvider;

return Application::configure(basePath: dirname(__DIR__))
    ->withProviders([
        \Illuminate\Config\ConfigServiceProvider::class,
        \Illuminate\Encryption\EncryptionServiceProvider::class,
        \Illuminate\Foundation\Providers\ConsoleSupportServiceProvider::class,
        AppServiceProvider::class,
        EventServiceProvider::class,
    ])
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function ($middleware) {
        $middleware->statefulApi();
    })
    ->withExceptions(function ($exceptions) {
        //
    })->create();
