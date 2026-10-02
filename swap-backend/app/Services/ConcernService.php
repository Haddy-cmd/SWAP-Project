<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Concern;
use App\Models\ConcernMessage;
use App\Models\User;
use App\Notifications\ConcernMessageNotification;
use App\Notifications\ConcernRepliedNotification;
use App\Notifications\ConcernSubmittedNotification;
use App\Support\AfterCommit;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * Concerns: any signed-in user writes to the DSA from the SWAP Assistant's Ask the DSA tab; admins
 * answer from the Concerns inbox, and the reply reaches the student in the
 * portal and by email.
 */
class ConcernService
{
    public const MSG_RESOLVED = 'This concern is resolved. Start a new one above if you still need help.';

    public function submit(User $user, array $data): Concern
    {
        $concern = Concern::create([
            'user_id' => $user->id,
            'subject' => $data['subject'],
            'message' => $data['message'],
            'status' => Concern::STATUS_OPEN,
        ]);
        // The opener is the first message in the thread.
        $concern->messages()->create(['user_id' => $user->id, 'from_staff' => false, 'body' => $data['message']]);
        AuditLog::record('concern_submitted', $concern, null, $concern->only(['subject', 'status']), $user->id);

        $concern->setRelation('user', $user);
        $this->notifyAdmins($concern, fn ($c) => new ConcernSubmittedNotification($c));

        return $concern->load('messages.user:id,name');
    }

    /** The student adds a follow-up to their own thread while it is not yet resolved. */
    public function addMessage(Concern $concern, User $user, string $body): Concern
    {
        if ($concern->status === Concern::STATUS_RESOLVED) {
            throw new UnprocessableEntityHttpException(self::MSG_RESOLVED);
        }

        $concern->messages()->create(['user_id' => $user->id, 'from_staff' => false, 'body' => $body]);
        AuditLog::record('concern_message_added', $concern, null, ['from' => 'student'], $user->id);

        $concern->setRelation('user', $user);
        $this->notifyAdmins($concern, fn ($c) => new ConcernMessageNotification($c));

        return $concern->load('messages.user:id,name');
    }

    /** @param callable(Concern): \Illuminate\Notifications\Notification $make */
    private function notifyAdmins(Concern $concern, callable $make): void
    {
        foreach (User::where('role', 'admin')->where('is_active', true)->get() as $admin) {
            AfterCommit::quietly(
                fn () => $admin->notify($make($concern)),
                'Concern admin notification',
                ['concern_id' => $concern->id, 'admin_id' => $admin->id],
            );
        }
    }

    /** @return Collection<int, Concern> the user's own concerns with their threads, newest first. */
    public function mine(User $user): Collection
    {
        return Concern::with('messages.user:id,name')->where('user_id', $user->id)->latest()->get();
    }

    public function inbox(?string $status, int $perPage = 20): LengthAwarePaginator
    {
        return Concern::with(['user.profile', 'respondedBy:id,name', 'messages.user:id,name'])
            ->when($status, fn ($q) => $q->where('status', $status))
            // Open first, then in progress, then resolved; newest first within each.
            ->orderByRaw("CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END")
            ->latest()
            ->paginate($perPage);
    }

    /** @return array<string, int> open / in_progress / resolved totals for the inbox tabs. */
    public function counts(): array
    {
        $counts = Concern::selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return collect(Concern::STATUSES)->mapWithKeys(fn ($s) => [$s => (int) ($counts[$s] ?? 0)])->all();
    }

    /** Set the status and/or reply. A new or changed reply notifies the student. */
    public function update(Concern $concern, array $data, User $admin): Concern
    {
        $old = $concern->only(['status', 'response']);
        $response = isset($data['response']) ? trim((string) $data['response']) : null;
        $replied = $response !== null && $response !== '' && $response !== $concern->response;

        $concern->status = $data['status'];
        if ($replied) {
            $concern->fill(['response' => $response, 'responded_by' => $admin->id, 'responded_at' => now()]);
            // The reply also joins the thread.
            $concern->messages()->create(['user_id' => $admin->id, 'from_staff' => true, 'body' => $response]);
        }
        $concern->save();

        AuditLog::record('concern_updated', $concern, $old, $concern->only(['status', 'response']), $admin->id);

        if ($replied) {
            $concern->loadMissing('user');
            AfterCommit::quietly(
                fn () => $concern->user?->notify(new ConcernRepliedNotification($concern)),
                'Concern reply notification',
                ['concern_id' => $concern->id],
            );
        }

        return $concern->load(['user.profile', 'respondedBy:id,name', 'messages.user:id,name']);
    }
}
