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
        $query = User::with('profile')->orderByDesc('created_at');

        if (!empty($filters['role'])) {
            $query->where('role', $filters['role']);
        }

        if (!empty($filters['is_active'])) {
            $query->where('is_active', $filters['is_active'] === 'true');
        }

        if (!empty($filters['search'])) {
            $query->where(fn ($q) =>
                $q->where('name', 'ilike', "%{$filters['search']}%")
                    ->orWhere('email', 'ilike', "%{$filters['search']}%")
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
        // Cascade delete related assignments and applications so they don't linger in lists/analytics
        $user->assignment()->delete();
        $user->applications()->delete();

        // Release email unique constraint so the user can re-register if needed
        $user->email = $user->email . '_deleted_' . time();
        $user->save();

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
