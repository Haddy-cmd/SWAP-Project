<?php

namespace App\Events;

use App\Models\TimeLog;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class HoursVerified implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly TimeLog $timeLog) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel("user.{$this->timeLog->user_id}")];
    }

    public function broadcastAs(): string
    {
        return 'HoursVerified';
    }

    public function broadcastWith(): array
    {
        return [
            'log_id' => $this->timeLog->id,
            'verified_hours' => $this->timeLog->duration_hours,
            'message' => "Your attendance log of {$this->timeLog->duration_hours} hours has been verified.",
        ];
    }
}
