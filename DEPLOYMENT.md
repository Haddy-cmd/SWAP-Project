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
2. On **swap-backend**, set the secret vars: `APP_KEY` (`php artisan key:generate --show`),
   `APP_URL` (the backend URL), `FRONTEND_URL` (the Vercel URL from below), `ADMIN_EMAIL` /
   `ADMIN_PASSWORD` (the first admin account — `ProductionAdminSeeder` refuses to create one in
   production without them), and `MAIL_MAILER` + the `MAIL_*` vars from §3. Don't use the `log`
   mailer in production: it writes password-reset and invitation links into the service logs.
3. DB credentials wire automatically from the database via `render.yaml`. The web service runs
   `migrate --force` + config/route caching on boot through [`start.sh`](./swap-backend/start.sh).

### File storage (Cloudflare R2)
Render's free disk is wiped on every restart and redeploy, so uploads kept there (signatures, profile
photos, application documents, promissory files, selfies, claim stubs) disappear while the database
still points to them — a signature then shows as a broken image and the stub prints no ink.
1. Cloudflare → R2 → create a bucket, then **Manage R2 API tokens** → create a token with
   **Object Read & Write** on that bucket.
2. On **swap-backend** set `DOCUMENTS_DISK=r2`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
   `R2_BUCKET` and `R2_ENDPOINT` (`https://<account-id>.r2.cloudflarestorage.com`). The bucket stays
   private — the API streams every file after checking who is asking.
3. Make sure `APP_URL` is the backend's **https** address: signature and photo links are built from it.
4. After the redeploy, open **Admin → System Testing → File storage → Check storage**. It shows the disk in
   use, saves and reads back a test file, checks `APP_URL`, and lists the accounts whose signature or
   photo is on record but gone. Files saved before R2 can't be recovered: those people draw their signature
   (or upload their photo) again. A redrawn signature is also put back on the claim stubs that lost it.

> **Queue:** `render.yaml` uses `QUEUE_CONNECTION=sync` (notifications send inline) to stay on the
> free tier. For async delivery, add a `worker` service running the `queue:work` command from §1 and
> switch to `QUEUE_CONNECTION=database`. **Mail:** set `MAIL_*` (§3) to turn on emails.

### Frontend (Vercel)
1. Vercel → **Add New** → **Project** → import the repo → set **Root Directory** to `swap-frontend`.
2. Add env var `NEXT_PUBLIC_API_URL = https://<backend>/api` (note the `/api` suffix — routes live under `/api`).
3. Deploy (auto-detected Next.js). Copy the Vercel URL back into the backend's `FRONTEND_URL` and redeploy
   the backend so [`config/cors.php`](./swap-backend/config/cors.php) allows it.

### First-run
- The admin account is created on boot from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (step 2). Change the
  password from the Profile page after first sign-in.
- **Do not run seeders in production** unless you want the demo data.

> Other hosts (Railway, Fly.io) build the same `Dockerfile` — just set the same env vars by hand, and
> run the queue worker + scheduler from §1–§2 (e.g. via supervisor + crontab on a VPS).

## 6. Speed on the free plan

What the code already does: OPcache (with a file cache for the scheduler's processes) and four
`php artisan serve` workers (`PHP_CLI_SERVER_WORKERS`, default 4 in `start.sh`), so a page's parallel
API calls don't queue. What only the hosting can fix:

- **Cold starts.** Render's free web service sleeps after 15 minutes without traffic; the next visitor
  waits ~20–60 s while it wakes. Either keep it awake with a free pinger (cron-job.org or UptimeRobot)
  calling `https://<backend>/up` every 10 minutes — one always-on service fits in the free plan's
  750 instance-hours a month — or move to the Starter plan (no sleep, more CPU).
- **CPU.** The free instance has a small CPU share, so every request is slower than on a laptop. The
  Starter plan is the direct fix.
- **Distance.** Without a `region:` in `render.yaml` the service and database run in Oregon (US), adding
  ~0.15–0.2 s to every call from the Philippines. Singapore is closest, but Render can't move an existing
  service: it means creating a new service + database there (`region: singapore`) and copying the data.
