<?php

namespace App\Events;

use App\Models\Application;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ApplicationRejected implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly Application $application) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel("user.{$this->application->user_id}")];
    }

    public function broadcastAs(): string
    {
        return 'ApplicationStatusChanged';
    }

    public function broadcastWith(): array
    {
        return [
            'application_id' => $this->application->id,
            'status' => 'rejected',
            'message' => 'Your SWAP application has been reviewed. Please check the remarks for details.',
        ];
    }
}
