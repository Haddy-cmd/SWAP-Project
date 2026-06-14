<?php

namespace App\Events;

use App\Models\StipendHistory;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class StipendReleased implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly StipendHistory $stipend) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel("user.{$this->stipend->user_id}")];
    }

    public function broadcastAs(): string
    {
        return 'NewNotification';
    }

    public function broadcastWith(): array
    {
        return [
            'title' => 'Stipend Released',
            'message' => "Your stipend of ₱{$this->stipend->amount} has been released.",
            'type' => 'stipend',
        ];
    }
}
