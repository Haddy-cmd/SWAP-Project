# SWAP Portal — Production Deployment Notes

Dev runs fine on the defaults (`QUEUE_CONNECTION=sync`, no worker). **Production needs three things
the dev setup doesn't:** an async queue worker, a scheduler cron, and SMTP mail. This document covers them.

---

## 1. Async queue (emails & notifications off the request path)

In dev, `QUEUE_CONNECTION=sync` runs every job inline — so sending an email blocks the HTTP response.
In production, switch to the database queue (tables already migrated via `create_queue_tables`).

**`.env` (production):**
```
QUEUE_CONNECTION=database
```

**Run a worker (keep it alive — see supervisor below).** Jobs are dispatched onto the `notifications`
queue, so the worker must include it:
```bash
php artisan queue:work --queue=notifications,default --tries=3 --backoff=60
```

> ⚠️ A bare `php artisan queue:work` only processes the `default` queue and will silently skip every
> notification. Always pass `--queue=notifications,default`.

**Keep the worker running with supervisor** (`/etc/supervisor/conf.d/swap-worker.conf`):
```
[program:swap-worker]
command=php /path/to/swap-backend/artisan queue:work --queue=notifications,default --tries=3 --backoff=60
autostart=true
autorestart=true
numprocs=1
redirect_stderr=true
stdout_logfile=/path/to/swap-backend/storage/logs/worker.log
stopwaitsecs=3600
```
Reload after deploys so workers pick up new code: `php artisan queue:restart`.

Failed jobs land in the `failed_jobs` table — inspect with `php artisan queue:failed`,
retry with `php artisan queue:retry all`.

---

## 2. Scheduler (auto-close stale attendance + reports)

The hourly safety net (`attendance:close-stale`) and the weekly/monthly report jobs are registered in
`routes/console.php`. They only fire if Laravel's scheduler runs. Add **one** cron entry:

```
* * * * * cd /path/to/swap-backend && php artisan schedule:run >> /dev/null 2>&1
```

Verify what's scheduled: `php artisan schedule:list`.

---

## 3. Mail (SMTP)

Notifications that email recipients/applicants/admins (approval, rejection, interview scheduled,
hours verified/rejected, stipend released) use the `mail` channel. They no-op silently unless SMTP is
configured.

**`.env` (production):**
```
MAIL_MAILER=smtp
MAIL_HOST=smtp.your-provider.com
MAIL_PORT=587
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="no-reply@your-domain"
MAIL_FROM_NAME="SWAP Portal — MSU Marawi"

# Used by notification "action" links
FRONTEND_URL=https://your-frontend-domain
APP_URL=https://your-api-domain
```

> In-app-only notifications (`ApplicationSubmittedNotification` → admin, `HoursPendingVerificationNotification`
> → supervisor) deliberately use only the `database` channel to avoid emailing on every submission/clock-out.
> If you want those emailed too, add `'mail'` to their `via()` and implement `toMail()`.

---

## 4. Other production checklist
- `APP_ENV=production`, `APP_DEBUG=false`, run `php artisan key:generate` once.
- `php artisan migrate --force` on deploy.
- `php artisan config:cache route:cache` (re-run on each deploy).
- Serve the frontend over **HTTPS** — browser Geolocation (geofenced clock-in) requires a secure context.
- Point the frontend `NEXT_PUBLIC_API_URL` at the production API origin.
- **PostgreSQL is required** — the analytics queries use `TO_CHAR` / `DATE_TRUNC` and
  the schema uses generated columns. SQLite/MySQL will break in production.

---

## 5. Platform quick-start — Render (API + DB) + Vercel (frontend)

Files added for this path:
[`render.yaml`](./render.yaml) · [`swap-backend/Dockerfile`](./swap-backend/Dockerfile) ·
[`swap-backend/start.sh`](./swap-backend/start.sh) · [`swap-backend/config/cors.php`](./swap-backend/config/cors.php) ·
[`swap-frontend/.env.example`](./swap-frontend/.env.example)

### Backend + database (Render)
1. Push to GitHub → Render → **New +** → **Blueprint** → select this repo (reads `render.yaml`).
   It provisions Postgres, the API (`web`), and the **scheduler** (`cron` running `schedule:run` — this
   covers §2 above, so you don't need a separate crontab on Render).
2. On **swap-backend**, set the three secret vars: `APP_KEY` (`php artisan key:generate --show`),
   `APP_URL` (the backend URL), and `FRONTEND_URL` (the Vercel URL from below).
3. DB credentials wire automatically from the database via `render.yaml`. The web service runs
   `migrate --force` + config/route caching on boot through [`start.sh`](./swap-backend/start.sh).

> **Queue:** `render.yaml` uses `QUEUE_CONNECTION=sync` (notifications send inline) to stay on the
> free tier. For async delivery, add a `worker` service running the `queue:work` command from §1 and
> switch to `QUEUE_CONNECTION=database`. **Mail:** set `MAIL_*` (§3) to turn on emails.

### Frontend (Vercel)
1. Vercel → **Add New** → **Project** → import the repo → set **Root Directory** to `swap-frontend`.
2. Add env var `NEXT_PUBLIC_API_URL = https://<backend>/api` (note the `/api` suffix — routes live under `/api`).
3. Deploy (auto-detected Next.js). Copy the Vercel URL back into the backend's `FRONTEND_URL` and redeploy
   the backend so [`config/cors.php`](./swap-backend/config/cors.php) allows it.

### First-run
- Create an admin user (Render shell → `php artisan tinker` → `User::create([...])`).
- **Do not run seeders in production** unless you want the demo data.

> Other hosts (Railway, Fly.io) build the same `Dockerfile` — just set the same env vars by hand, and
> run the queue worker + scheduler from §1–§2 (e.g. via supervisor + crontab on a VPS).
