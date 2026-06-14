<?php

namespace App\Events;

use App\Models\Application;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ApplicationApproved implements ShouldBroadcast
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
            'status' => 'approved',
            'message' => 'Congratulations! Your SWAP application has been approved.',
        ];
    }
}
