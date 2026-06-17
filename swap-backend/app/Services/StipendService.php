<?php

namespace App\Services;

use App\Events\StipendReleased;
use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\StipendHistory;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class StipendService
{
    /** Default monthly stipend (PHP) suggested when releasing — admin can override. */
    private const DEFAULT_STIPEND_AMOUNT = 1500;

    /**
     * Recipients whose active assignment has met its required verified hours and who have
     * not yet been paid for that academic period.
     */
    public function eligibleRecipients(): array
    {
        $assignments = Assignment::with('user.profile')
            ->where('status', 'active')
            ->where('required_hours', '>', 0)
            ->withSum(['timeLogs as verified_sum' => fn ($q) => $q->where('status', 'verified')], 'duration_hours')
            ->get()
            ->filter(fn ($a) => (float) ($a->verified_sum ?? 0) >= (float) $a->required_hours);

        $releasedKeys = StipendHistory::where('status', 'released')
            ->get(['user_id', 'academic_year', 'semester'])
            ->map(fn ($s) => "{$s->user_id}|{$s->academic_year}|{$s->semester}")
            ->flip();

        return $assignments
            ->reject(fn ($a) => $releasedKeys->has("{$a->user_id}|{$a->academic_year}|{$a->semester}"))
            ->map(fn ($a) => [
                'user_id' => $a->user_id,
                'name' => $a->user->profile?->full_name ?? $a->user->name,
                'academic_year' => $a->academic_year,
                'semester' => $a->semester,
                'required_hours' => (float) $a->required_hours,
                'verified_hours' => (float) ($a->verified_sum ?? 0),
                'suggested_amount' => self::DEFAULT_STIPEND_AMOUNT,
            ])
            ->values()
            ->all();
    }

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
