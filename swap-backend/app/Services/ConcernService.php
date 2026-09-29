<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Concern;
use App\Models\User;
use App\Notifications\ConcernRepliedNotification;
use App\Notifications\ConcernSubmittedNotification;
use App\Support\AfterCommit;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

/**
 * Concerns: any signed-in user writes to the DSA from the Help page; admins
 * answer from the Concerns inbox, and the reply reaches the student in the
 * portal and by email.
 */
class ConcernService
{
    public function submit(User $user, array $data): Concern
    {
        $concern = Concern::create([
            'user_id' => $user->id,
            'subject' => $data['subject'],
            'message' => $data['message'],
            'status' => Concern::STATUS_OPEN,
        ]);
        AuditLog::record('concern_submitted', $concern, null, $concern->only(['subject', 'status']), $user->id);

        $concern->setRelation('user', $user);
        foreach (User::where('role', 'admin')->where('is_active', true)->get() as $admin) {
            AfterCommit::quietly(
                fn () => $admin->notify(new ConcernSubmittedNotification($concern)),
                'Concern submitted notification',
                ['concern_id' => $concern->id, 'admin_id' => $admin->id],
            );
        }

        return $concern;
    }

    /** @return Collection<int, Concern> the user's own concerns, newest first. */
    public function mine(User $user): Collection
    {
        return Concern::where('user_id', $user->id)->latest()->get();
    }

    public function inbox(?string $status, int $perPage = 20): LengthAwarePaginator
    {
        return Concern::with(['user.profile', 'respondedBy:id,name'])
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

        return $concern->load(['user.profile', 'respondedBy:id,name']);
    }
}
