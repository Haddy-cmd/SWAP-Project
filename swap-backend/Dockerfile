# ---- Production image for the SWAP Laravel API ----
FROM php:8.2-cli

# System libraries + PHP extensions (PostgreSQL is required: the app uses
# TO_CHAR / DATE_TRUNC / generated columns that only work on Postgres).
RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libpq-dev libzip-dev libicu-dev \
    && docker-php-ext-install pdo pdo_pgsql pgsql zip intl bcmath opcache \
    && rm -rf /var/lib/apt/lists/*

# OPcache tuning (production). enable_cli is essential here because the API is
# served via `php artisan serve` (CLI SAPI) — without it OPcache has no effect.
COPY docker/opcache.ini /usr/local/etc/php/conf.d/opcache.ini

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Install dependencies and the app (one step = reliable script execution).
COPY . .
RUN composer install --no-dev --optimize-autoloader --no-interaction \
    && chmod +x ./start.sh

# Render/Railway inject $PORT; default to 8000 locally.
EXPOSE 8000
CMD ["./start.sh"]
