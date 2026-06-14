<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AttendanceStarted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int $supervisorId,
        public readonly string $studentName,
        public readonly string $timeIn
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel("supervisor.{$this->supervisorId}")];
    }

    public function broadcastAs(): string
    {
        return 'AttendanceStarted';
    }

    public function broadcastWith(): array
    {
        return [
            'student_name' => $this->studentName,
            'time_in' => $this->timeIn,
        ];
    }
}
