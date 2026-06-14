<?php

namespace App\Events;

use App\Models\Application;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ApplicationSubmitted
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly Application $application) {}
}
