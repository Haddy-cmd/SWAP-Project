<?php

namespace App\Events;

use App\Models\Application;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class InterviewScheduled implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly Application $application) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel("user.{$this->application->user_id}")];
    }

    public function broadcastAs(): string
    {
        return 'InterviewScheduled';
    }

    public function broadcastWith(): array
    {
        return [
            'application_id' => $this->application->id,
            'interview_date' => $this->application->interview?->scheduled_at->toISOString(),
            'location' => $this->application->interview?->location,
            'message' => 'Your interview has been scheduled. Please check the details.',
        ];
    }
}
