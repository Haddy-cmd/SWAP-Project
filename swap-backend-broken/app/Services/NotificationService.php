<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class NotificationService
{
    public function getForUser(User $user, int $perPage = 15): LengthAwarePaginator
    {
        return Notification::where('notifiable_type', User::class)
            ->where('notifiable_id', $user->id)
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    public function markAsRead(User $user, string $notificationId): void
    {
        Notification::where('notifiable_id', $user->id)
            ->where('notifiable_type', User::class)
            ->where('id', $notificationId)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
    }

    public function markAllAsRead(User $user): void
    {
        Notification::where('notifiable_id', $user->id)
            ->where('notifiable_type', User::class)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
    }

    public function getUnreadCount(User $user): int
    {
        return Notification::where('notifiable_id', $user->id)
            ->where('notifiable_type', User::class)
            ->whereNull('read_at')
            ->count();
    }

    public function broadcastToAll(string $title, string $message, string $type = 'info'): void
    {
        User::where('is_active', true)->each(function (User $user) use ($title, $message, $type) {
            $user->notify(new \App\Notifications\ApplicationApprovedNotification([
                'title' => $title,
                'message' => $message,
                'type' => $type,
            ]));
        });
    }
}
