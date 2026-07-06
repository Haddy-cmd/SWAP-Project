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

# Safety net on boot: force-close any attendance logs left open past the max
# session (forgotten clock-outs), crediting only up to the cap. Non-fatal so a
# hiccup here never blocks the deploy.
php artisan attendance:close-stale || true

# Run Laravel's scheduler in the background so hourly jobs (e.g. attendance:close-stale)
# keep firing while the service is up — Render's single web service has no cron.
php artisan schedule:work &

# Boot the API on the platform-provided port (foreground — keeps the container alive).
php artisan serve --host 0.0.0.0 --port "${PORT:-8000}"
