<?php

namespace App\Http\Controllers\Shared;

use App\Http\Controllers\Controller;
use App\Resources\NotificationResource;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function __construct(private readonly NotificationService $notificationService) {}

    public function index(Request $request): JsonResponse
    {
        $notifications = $this->notificationService->getForUser($request->user());
        $unreadCount = $this->notificationService->getUnreadCount($request->user());

        return response()->json([
            'data' => NotificationResource::collection($notifications->items()),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'per_page' => $notifications->perPage(),
                'total' => $notifications->total(),
                'unread_count' => $unreadCount,
            ],
        ]);
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        $this->notificationService->markAsRead($request->user(), $id);

        return response()->json(['message' => 'Notification marked as read.']);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $this->notificationService->markAllAsRead($request->user());

        return response()->json(['message' => 'All notifications marked as read.']);
    }
}
