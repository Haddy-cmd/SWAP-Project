#!/usr/bin/env sh
set -e

# Apply database migrations against the production DB (non-interactive).
php artisan migrate --force

# Cache config / routes / views for performance.
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Boot the API on the platform-provided port.
php artisan serve --host 0.0.0.0 --port "${PORT:-8000}"
