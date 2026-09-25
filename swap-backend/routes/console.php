<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Two schedulers can run in production: `schedule:work` inside the web container
// (start.sh) and the Render cron service (render.yaml). Their file caches aren't
// shared, so the locks live in the database — onOneServer() then lets exactly
// one of them run each job per slot.
Schedule::useCache('database');

// Safety net: force-close attendance logs left open past the max session length.
Schedule::command('attendance:close-stale')->hourly()->withoutOverlapping()->onOneServer();

// Weekly nudge to recipients without a signature specimen (banner covers the
// daily reminder; this is the email + in-app ping). Self-dedupes via unread check.
Schedule::command('remind:missing-signatures')->weekly()->withoutOverlapping()->onOneServer();

// Login tokens expire after 7 days (User::TOKEN_TTL_DAYS); clear the dead rows.
Schedule::command('sanctum:prune-expired --hours=24')->daily()->onOneServer();
