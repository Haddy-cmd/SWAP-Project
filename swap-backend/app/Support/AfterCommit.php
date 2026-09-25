<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

/**
 * Side effects (events, notifications, mail) that follow an already-committed
 * write. With QUEUE_CONNECTION=sync they run inline, so a mail outage would turn
 * a saved change into a 500 — and the user's retry would then hit a state check
 * ("already claimed", "already decided"). Run them through here instead: the
 * failure is logged, the request still succeeds.
 */
class AfterCommit
{
    public static function quietly(callable $sideEffect, string $what, array $context = []): void
    {
        try {
            $sideEffect();
        } catch (\Throwable $e) {
            Log::warning("{$what} failed after commit", $context + ['error' => $e->getMessage()]);
        }
    }
}
