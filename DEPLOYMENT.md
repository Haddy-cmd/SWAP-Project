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
