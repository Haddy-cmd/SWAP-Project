<?php

namespace App\Providers;

use App\Repositories\ApplicationRepository;
use App\Repositories\AssignmentRepository;
use App\Repositories\Contracts\ApplicationRepositoryInterface;
use App\Repositories\Contracts\AssignmentRepositoryInterface;
use App\Repositories\Contracts\TimeLogRepositoryInterface;
use App\Repositories\Contracts\UserRepositoryInterface;
use App\Repositories\TimeLogRepository;
use App\Repositories\UserRepository;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\ServiceProvider;
use Illuminate\Config\Repository as ConfigRepository;
use Illuminate\Auth\Notifications\ResetPassword;
use Symfony\Component\Mailer\Bridge\Brevo\Transport\BrevoTransportFactory;
use Symfony\Component\Mailer\Transport\Dsn;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Manually register config if not already registered
        if (!$this->app->has('config')) {
            $this->app->singleton('config', function ($app) {
                $config = new ConfigRepository();
                // Load config files
                foreach (glob($app->basePath('config') . '/*.php') as $file) {
                    $config->set(basename($file, '.php'), require $file);
                }
                return $config;
            });
        }

        $this->app->bind(ApplicationRepositoryInterface::class, ApplicationRepository::class);
        $this->app->bind(AssignmentRepositoryInterface::class, AssignmentRepository::class);
        $this->app->bind(TimeLogRepositoryInterface::class, TimeLogRepository::class);
        $this->app->bind(UserRepositoryInterface::class, UserRepository::class);
    }

    public function boot(): void
    {
        // Point the password-reset email link at the deployed frontend (Vercel)
        // instead of Laravel's default `password.reset` route, which doesn't
        // exist in this API-only app and would otherwise throw a 500.
        ResetPassword::createUrlUsing(function ($user, string $token) {
            return \App\Support\Frontend::url("/reset-password?token={$token}&email=" . urlencode($user->email));
        });

        // Brevo mail transport (HTTP API, not SMTP) so real emails can be sent
        // from hosts that block outbound SMTP ports, like Render's free tier.
        // Activate with MAIL_MAILER=brevo + BREVO_API_KEY.
        Mail::extend('brevo', function () {
            return (new BrevoTransportFactory())->create(
                new Dsn('brevo+api', 'default', config('services.brevo.key'))
            );
        });
    }
}
