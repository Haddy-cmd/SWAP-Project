<?php

namespace App\Repositories;

use App\Models\Application;
use App\Repositories\Contracts\ApplicationRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

class ApplicationRepository implements ApplicationRepositoryInterface
{
    public function findById(int $id): ?Application
    {
        return Application::with(['user.profile', 'documents', 'interview'])
            ->find($id);
    }

    public function findByUser(int $userId): Collection
    {
        return Application::with(['documents', 'interview'])
            ->where('user_id', $userId)
            ->orderByDesc('created_at')
            ->get();
    }

    public function findForUserAndPeriod(int $userId, string $academicYear, string $semester): ?Application
    {
        return Application::where('user_id', $userId)
            ->where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->first();
    }

    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = Application::with(['user.profile', 'interview'])
            ->orderByDesc('created_at');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['exclude_status'])) {
            $query->whereNotIn('status', (array) $filters['exclude_status']);
        }

        if (!empty($filters['academic_year'])) {
            $query->where('academic_year', $filters['academic_year']);
        }

        if (!empty($filters['semester'])) {
            $query->where('semester', $filters['semester']);
        }

        if (!empty($filters['search'])) {
            $query->whereHas('user', fn ($q) =>
                $q->where('name', 'ilike', "%{$filters['search']}%")
                    ->orWhere('email', 'ilike', "%{$filters['search']}%")
            );
        }

        return $query->paginate($perPage);
    }

    public function create(array $data): Application
    {
        return Application::create($data);
    }

    public function update(Application $application, array $data): Application
    {
        $application->update($data);

        return $application->fresh(['user.profile', 'documents', 'interview']);
    }

    public function countByStatus(string $academicYear, string $semester): array
    {
        $counts = Application::where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        return array_merge([
            'submitted' => 0,
            'under_review' => 0,
            'interview_scheduled' => 0,
            'approved' => 0,
            'rejected' => 0,
        ], $counts);
    }
}
