<?php

namespace App\Repositories;

use App\Models\User;
use App\Repositories\Contracts\UserRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class UserRepository implements UserRepositoryInterface
{
    public function findById(int $id): ?User
    {
        return User::with('profile')->find($id);
    }

    public function findByEmail(string $email): ?User
    {
        return User::where('email', $email)->first();
    }

    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = User::with(['profile', 'office:id,name']);
        // Newest first by default; Oldest first; Name A–Z.
        match ($filters['sort'] ?? 'new') {
            'old' => $query->orderBy('created_at')->orderBy('id'),
            'az' => $query->orderByRaw('LOWER(name)')->orderBy('id'),
            default => $query->orderByDesc('created_at')->orderByDesc('id'),
        };

        if (!empty($filters['role'])) {
            $query->where('role', $filters['role']);
        }

        // Signed up the old way and never verified the email.
        if (!empty($filters['unverified'])) {
            $query->whereNull('email_verified_at');
        }

        if (!empty($filters['is_active'])) {
            $query->where('is_active', $filters['is_active'] === 'true');
        }

        if (!empty($filters['search'])) {
            $term = "%{$filters['search']}%";
            $query->where(fn ($q) =>
                $q->where('name', 'ilike', $term)
                    ->orWhere('email', 'ilike', $term)
                    ->orWhere('employee_id', 'ilike', $term)
                    ->orWhereHas('profile', fn ($p) => $p->where('student_id_number', 'ilike', $term))
            );
        }

        return $query->paginate($perPage);
    }

    public function create(array $data): User
    {
        return User::create($data);
    }

    public function update(User $user, array $data): User
    {
        $user->update($data);

        return $user->fresh('profile');
    }

    public function softDelete(User $user): void
    {
        // Records are kept (applications, hours, reports, notes, stipends) so past terms stay complete.
        // Only what's still open is closed, so it doesn't linger in queues and rosters without a person.
        \App\Models\Assignment::where('user_id', $user->id)->where('status', 'active')->update(['status' => 'completed']);
        \App\Models\Application::where('user_id', $user->id)
            ->whereIn('status', ['submitted', 'under_review', 'interview_scheduled'])
            ->update(['status' => 'rejected', 'remarks' => 'Account deleted by the DSA.', 'reviewed_at' => now()]);

        // Release email unique constraint so the user can re-register if needed
        $user->email = $user->email . '_deleted_' . time();
        $user->save();

        // The profile holds the student ID under its own unique index. Soft-delete
        // it alongside the user, or that ID stays taken forever and the student can
        // never sign up again.
        $user->profile()?->delete();

        $user->delete();
    }

    public function countByRole(): array
    {
        return User::selectRaw('role, COUNT(*) as count')
            ->groupBy('role')
            ->pluck('count', 'role')
            ->toArray();
    }
}
