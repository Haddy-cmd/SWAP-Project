<?php

namespace App\Services;

use App\Events\StipendReleased;
use App\Models\AuditLog;
use App\Models\StipendHistory;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class StipendService
{
    public function getHistory(User $user, int $perPage = 15): LengthAwarePaginator
    {
        return StipendHistory::where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    public function paginateAll(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = StipendHistory::with(['recipient.profile', 'releasedBy'])
            ->orderByDesc('created_at');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['academic_year'])) {
            $query->where('academic_year', $filters['academic_year']);
        }

        return $query->paginate($perPage);
    }

    public function release(array $data, User $admin): StipendHistory
    {
        $stipend = StipendHistory::create([
            'user_id' => $data['user_id'],
            'amount' => $data['amount'],
            'academic_year' => $data['academic_year'],
            'semester' => $data['semester'],
            'period_label' => $data['period_label'] ?? null,
            'status' => 'released',
            'released_by' => $admin->id,
            'released_at' => now(),
            'remarks' => $data['remarks'] ?? null,
        ]);

        AuditLog::record('created', $stipend, null, $stipend->toArray(), $admin->id);
        event(new StipendReleased($stipend));

        return $stipend->load(['recipient.profile', 'releasedBy']);
    }

    public function getSummary(string $academicYear, string $semester): array
    {
        $released = StipendHistory::where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->where('status', 'released')
            ->sum('amount');

        $pending = StipendHistory::where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->where('status', 'pending')
            ->sum('amount');

        return [
            'total_released' => (float) $released,
            'total_pending' => (float) $pending,
        ];
    }
}
