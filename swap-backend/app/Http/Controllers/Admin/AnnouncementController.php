<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Announcement\StoreAnnouncementRequest;
use App\Models\Announcement;
use App\Resources\AnnouncementResource;
use App\Services\AnnouncementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin → Announcements: message every active recipient (portal + email), see what was sent, delete a mistake. */
class AnnouncementController extends Controller
{
    public function __construct(private readonly AnnouncementService $announcements) {}

    public function index(): JsonResponse
    {
        $page = $this->announcements->history();

        return response()->json([
            'data' => AnnouncementResource::collection($page->items()),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
                // Who a new announcement would reach right now.
                'active_recipients' => AnnouncementService::activeRecipients()->count(),
            ],
        ]);
    }

    public function store(StoreAnnouncementRequest $request): JsonResponse
    {
        $data = $request->validated();
        $announcement = $this->announcements->send($request->user(), $data['title'], $data['message']);

        $sent = $announcement->recipient_count;
        $message = $announcement->emailed_count === $sent
            ? "Announcement sent to {$sent} active recipient(s) in the portal and by email."
            : "Announcement sent to {$sent} active recipient(s) in the portal. The email reached {$announcement->emailed_count} of them; check the mail settings.";

        return response()->json([
            'data' => new AnnouncementResource($announcement),
            'message' => $message,
        ], 201);
    }

    /** Delete a sent announcement: gone from the history and from recipients' notifications. */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $removed = $this->announcements->delete(Announcement::findOrFail($id), $request->user());

        return response()->json([
            'message' => "Announcement deleted and removed from the notifications of {$removed} recipient(s). Emails already sent can't be recalled.",
        ]);
    }
}
