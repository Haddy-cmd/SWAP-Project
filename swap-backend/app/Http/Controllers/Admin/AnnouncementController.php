<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Announcement\StoreAnnouncementRequest;
use App\Models\Announcement;
use App\Resources\AnnouncementResource;
use App\Services\AnnouncementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin → Announcements: message an audience (portal + email), see what was sent, delete a mistake. */
class AnnouncementController extends Controller
{
    public function __construct(private readonly AnnouncementService $announcements) {}

    public function index(Request $request): JsonResponse
    {
        $page = $this->announcements->history(15, $request->string('search')->limit(100)->toString() ?: null);

        return response()->json([
            'data' => AnnouncementResource::collection($page->items()),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
                // Who a new announcement would reach right now, per audience and per office.
                'active_recipients' => AnnouncementService::activeRecipients()->count(),
                ...AnnouncementService::audienceCounts(),
            ],
        ]);
    }

    public function store(StoreAnnouncementRequest $request): JsonResponse
    {
        $data = $request->validated();
        $audience = $data['audience'] ?? 'recipients';
        $officeId = $audience === 'office' ? (int) $data['office_id'] : null;
        $announcement = $this->announcements->send($request->user(), $data['title'], $data['message'], $request->file('attachments', []), $audience, $officeId);

        $sent = $announcement->recipient_count;
        $who = match ($audience) {
            'everyone' => 'active recipient(s) and supervisor(s)',
            'supervisors' => 'supervisor(s)',
            'new_recipients' => 'new recipient(s)',
            'office' => 'student(s) and supervisor(s) at ' . $announcement->office?->name,
            default => 'active recipient(s)',
        };
        // Test accounts held back by System Testing's email switch aren't a mail failure.
        $muted = AnnouncementService::emailMutedCount($audience, $officeId);
        $message = match (true) {
            $announcement->emailed_count === $sent => "Announcement sent to {$sent} {$who} in the portal and by email.",
            $announcement->emailed_count === $sent - $muted => "Announcement sent to {$sent} {$who} in the portal and by email ({$muted} test account(s) in the portal only: System Testing emails are off).",
            default => "Announcement sent to {$sent} {$who} in the portal. The email reached {$announcement->emailed_count} of them; check the mail settings.",
        };

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
