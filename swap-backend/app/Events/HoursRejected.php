<?php

namespace App\Events;

use App\Models\TimeLog;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class HoursRejected implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly TimeLog $timeLog,
        public readonly ?string $feedback = null
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel("user.{$this->timeLog->user_id}")];
    }

    public function broadcastAs(): string
    {
        return 'HoursRejected';
    }

    public function broadcastWith(): array
    {
        return [
            'log_id' => $this->timeLog->id,
            'feedback' => $this->feedback,
            'message' => 'Your attendance log has been rejected. Please review the feedback.',
        ];
    }
}
