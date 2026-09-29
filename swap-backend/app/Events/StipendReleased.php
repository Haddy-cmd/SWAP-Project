<?php

namespace App\Events;

use App\Models\StipendHistory;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Domain event; its listener sends the in-app + email notification. (No longer
 * broadcast: the real-time websocket stack was removed — the bell refreshes.)
 */
class StipendReleased
{
    use Dispatchable, SerializesModels;

    public function __construct(public readonly StipendHistory $stipend) {}
}
