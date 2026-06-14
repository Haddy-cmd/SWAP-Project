<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AttendanceCompleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int $supervisorId,
        public readonly string $studentName,
        public readonly float $durationHours,
        public readonly int $logId
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel("supervisor.{$this->supervisorId}")];
    }

    public function broadcastAs(): string
    {
        return 'AttendanceCompleted';
    }

    public function broadcastWith(): array
    {
        return [
            'student_name' => $this->studentName,
            'hours' => $this->durationHours,
            'log_id' => $this->logId,
            'pending' => true,
        ];
    }
}
