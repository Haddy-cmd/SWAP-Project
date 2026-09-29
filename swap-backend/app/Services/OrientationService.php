<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\OrientationAttendee;
use App\Models\OrientationSession;
use App\Models\User;
use App\Notifications\OrientationInvitationNotification;
use App\Support\AfterCommit;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * The orientation step between approval and office placement: sessions,
 * invitations and attendance. A new applicant (never placed before) must have
 * attended one before StoreAssignmentRequest lets them be placed; recipients
 * coming back through renewal already went through it and are exempt.
 */
class OrientationService
{
    /** Shared with the Assignments page so the UI shows the backend's exact words. */
    public const MSG_NOT_ORIENTED = 'This applicant has not attended an orientation yet. Mark their attendance, or place them anyway.';
    public const MSG_HAS_ATTENDANCE = 'Attendance has already been recorded for this session, so it cannot be deleted.';
    public const MSG_NOT_CANDIDATE = 'Only approved applicants who are not yet placed can be invited.';

    /** Placement needs an attended orientation: only for applicants never placed before. */
    public static function needsOrientation(User $user): bool
    {
        return $user->isApplicant() && !self::hasAttended($user->id);
    }

    public static function hasAttended(int $userId): bool
    {
        return OrientationAttendee::where('user_id', $userId)
            ->where('status', OrientationAttendee::STATUS_ATTENDED)
            ->exists();
    }

    /** @return Collection<int, OrientationSession> newest first, with attendees. */
    public function sessions(): Collection
    {
        return OrientationSession::with(['attendees.user.profile', 'creator:id,name'])
            ->orderByDesc('scheduled_at')
            ->get();
    }

    /**
     * Approved applicants who are not placed yet, with where they stand: the
     * people the admin invites and marks, and whom the Assignments page gates.
     */
    public function candidates(): Collection
    {
        $users = User::with(['profile'])
            ->where('role', 'applicant')
            ->where('is_active', true)
            ->whereHas('applications', fn ($q) => $q->where('status', 'approved'))
            ->orderBy('name')
            ->get();

        $rows = OrientationAttendee::with('session:id,title,scheduled_at')
            ->whereIn('user_id', $users->pluck('id'))
            ->get()
            ->groupBy('user_id');

        return $users->map(function (User $user) use ($rows) {
            $mine = $rows->get($user->id, collect());
            $attended = $mine->firstWhere('status', OrientationAttendee::STATUS_ATTENDED);
            $latest = $mine->sortByDesc(fn ($a) => $a->session?->scheduled_at)->first();

            return [
                'user_id' => $user->id,
                'name' => $user->profile?->full_name ?: $user->name,
                'student_id' => $user->profile?->student_id_number,
                'email' => $user->email,
                'orientation_status' => $attended ? 'attended' : ($latest?->status ?? 'not_invited'),
                'session_title' => ($attended ?? $latest)?->session?->title,
                'session_at' => ($attended ?? $latest)?->session?->scheduled_at?->toISOString(),
            ];
        })->values();
    }

    public function create(array $data, User $admin): OrientationSession
    {
        $session = OrientationSession::create($this->venueFields($data) + ['created_by' => $admin->id]);
        AuditLog::record('orientation_created', $session, null, $session->toArray(), $admin->id);

        return $session->load(['attendees.user.profile', 'creator:id,name']);
    }

    public function update(OrientationSession $session, array $data, User $admin): OrientationSession
    {
        $old = $session->toArray();
        $session->update($this->venueFields($data));
        AuditLog::record('orientation_updated', $session, $old, $session->toArray(), $admin->id);

        return $session->load(['attendees.user.profile', 'creator:id,name']);
    }

    public function delete(OrientationSession $session, User $admin): void
    {
        if ($session->attendees()->where('status', '!=', OrientationAttendee::STATUS_INVITED)->exists()) {
            throw new UnprocessableEntityHttpException(self::MSG_HAS_ATTENDANCE);
        }

        AuditLog::record('orientation_deleted', $session, $session->toArray(), null, $admin->id);
        $session->delete();
    }

    /**
     * Invite applicants: the given ones, or every candidate who has not attended an
     * orientation yet. Each gets an in-app + email notice with the date and venue.
     *
     * @return array{invited: int, already: int}
     */
    public function invite(OrientationSession $session, ?array $userIds, User $admin): array
    {
        $candidates = $this->candidates();

        if ($userIds !== null) {
            $outside = collect($userIds)->diff($candidates->pluck('user_id'));
            if ($outside->isNotEmpty()) {
                throw new UnprocessableEntityHttpException(self::MSG_NOT_CANDIDATE);
            }
            $targetIds = collect($userIds)->unique()->values();
        } else {
            $targetIds = $candidates->where('orientation_status', '!=', OrientationAttendee::STATUS_ATTENDED)->pluck('user_id');
        }

        $already = $session->attendees()->whereIn('user_id', $targetIds)->pluck('user_id');
        $newIds = $targetIds->diff($already)->values();

        DB::transaction(function () use ($session, $newIds, $admin) {
            foreach ($newIds as $userId) {
                $session->attendees()->create([
                    'user_id' => $userId,
                    'status' => OrientationAttendee::STATUS_INVITED,
                ]);
            }

            if ($newIds->isNotEmpty()) {
                AuditLog::record('orientation_invited', $session, null, ['user_ids' => $newIds->all()], $admin->id);
            }
        });

        $users = User::whereIn('id', $newIds)->get();
        foreach ($users as $user) {
            AfterCommit::quietly(
                fn () => $user->notify(new OrientationInvitationNotification($session)),
                'Orientation invitation notification',
                ['orientation_session_id' => $session->id, 'user_id' => $user->id],
            );
        }

        return ['invited' => $newIds->count(), 'already' => $already->count()];
    }

    /** Record attended / absent (or reset to invited). A walk-in who was not invited is added. */
    public function mark(OrientationSession $session, int $userId, string $status, User $admin): OrientationAttendee
    {
        $attendee = $session->attendees()->firstOrNew(['user_id' => $userId]);
        $old = $attendee->exists ? $attendee->only(['status', 'marked_by', 'marked_at']) : null;

        $attendee->fill([
            'status' => $status,
            'marked_by' => $status === OrientationAttendee::STATUS_INVITED ? null : $admin->id,
            'marked_at' => $status === OrientationAttendee::STATUS_INVITED ? null : now(),
        ])->save();

        AuditLog::record('orientation_attendance_marked', $attendee, $old, $attendee->only(['orientation_session_id', 'user_id', 'status']), $admin->id);

        return $attendee->load('user.profile');
    }

    /** The applicant's own invitations: soonest upcoming first, then the most recent past ones. */
    public function forApplicant(User $user): Collection
    {
        return OrientationAttendee::with('session')
            ->where('user_id', $user->id)
            ->get()
            ->sortBy(function (OrientationAttendee $a) {
                $at = $a->session->scheduled_at;

                return $at->isPast() ? [1, -$at->getTimestamp()] : [0, $at->getTimestamp()];
            })
            ->values();
    }

    /** Keep only the field the mode uses, so a switched mode never shows a stale venue. */
    private function venueFields(array $data): array
    {
        if (($data['mode'] ?? null) === 'online') {
            $data['location'] = null;
        } elseif (($data['mode'] ?? null) === 'in_person') {
            $data['meeting_link'] = null;
        }

        return $data;
    }
}
