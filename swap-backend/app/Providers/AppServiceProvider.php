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
use Illuminate\Support\ServiceProvider;
use Illuminate\Config\Repository as ConfigRepository;

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
        //
    }
}
