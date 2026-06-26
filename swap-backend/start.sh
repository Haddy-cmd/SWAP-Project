#!/usr/bin/env sh
set -e

# Apply database migrations against the production DB (non-interactive).
php artisan migrate --force

# Create the public/storage → storage/app/public symlink (idempotent).
php artisan storage:link 2>/dev/null || true

# Ensure an admin account exists (idempotent; no shell access needed on free tier).
php artisan db:seed --class=ProductionAdminSeeder --force

# Populate the chatbot FAQ knowledge base (idempotent — updateOrCreate keyed on
# question, so it's safe to re-run on every deploy and refreshes edited answers).
php artisan db:seed --class=FaqSeeder --force

# Cache config / routes / views for performance.
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Boot the API on the platform-provided port.
php artisan serve --host 0.0.0.0 --port "${PORT:-8000}"
