<?php

namespace App\Events;

use App\Models\Application;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Domain event; its listener sends the in-app + email notification. (No longer
 * broadcast: the real-time websocket stack was removed — the bell refreshes.)
 */
class ApplicationRejected
{
    use Dispatchable, SerializesModels;

    public function __construct(public readonly Application $application) {}
}
