<?php

namespace App\Reports\Datasets;

use App\Models\Assignment;
use App\Models\StipendHistory;
use App\Reports\ReportDataset;
use Illuminate\Support\Collection;

/** Every placement a recipient has had, the current one included: hours, verdict and stipend. */
class MyTermsDataset extends ReportDataset
{
    private const BADGES = [
        'qualified' => 'Qualified',
        'promissory_approved' => 'Deficient · Note Approved',
        'promissory_pending' => 'Deficient · Note Pending',
        'deficient' => 'Deficient',
        'in_progress' => 'In Progress',
    ];

    public function title(): string
    {
        return 'My Terms';
    }

    public function slug(): string
    {
        return 'my-terms';
    }

    public function needsTerm(): bool
    {
        return false;
    }

    public function defaultGroup(): ?string
    {
        return 'verdict';
    }

    public function columns(): array
    {
        return [
            self::col('term', 'Term'),
            self::col('office', 'Office', filterable: true),
            self::col('status', 'Placement', 'status', filterable: true),
            self::col('required_hours', 'Required Hours', 'hours', metric: true),
            self::col('verified_hours', 'Verified Hours', 'hours', metric: true),
            self::col('verdict', 'Verdict', 'status', filterable: true),
            self::col('deficient_hours', 'Deficient Hours', 'hours', metric: true),
            self::col('stipend', 'Stipend', 'status', filterable: true),
            self::col('amount', 'Amount', 'money', metric: true),
            self::col('released_at', 'Released', 'date'),
        ];
    }

    public function rows(): Collection
    {
        $user = $this->scope->user;
        $stubs = StipendHistory::where('user_id', $user->id)->orderByDesc('id')->get()
            ->groupBy(fn ($s) => "{$s->academic_year}|{$s->semester}");

        return Assignment::with('office')
            ->where('user_id', $user->id)
            ->withSum(['timeLogs as verified_sum' => fn ($q) => $q->where('status', 'verified')], 'duration_hours')
            ->withPromissoryFlags()
            ->orderByDesc('start_date')->orderByDesc('id')
            ->get()
            ->map(function (Assignment $a) use ($stubs) {
                // The live stub for the term if there is one, else the latest (e.g. void).
                $all = $stubs->get("{$a->academic_year}|{$a->semester}") ?? collect();
                $stub = $all->first(fn ($s) => $s->status !== StipendHistory::STATUS_VOID);

                return [
                    'term' => "{$a->semester} {$a->academic_year}",
                    'office' => $a->office?->name,
                    'status' => self::label($a->status),
                    'required_hours' => (float) $a->required_hours,
                    'verified_hours' => self::hours($a->verified_sum),
                    'verdict' => self::BADGES[$a->termBadge()] ?? 'In Progress',
                    'deficient_hours' => $a->deficient_hours !== null ? (float) $a->deficient_hours : null,
                    'stipend' => $stub ? 'Released' : ($all->isNotEmpty() ? 'Voided' : 'Not Released'),
                    'amount' => $stub ? round((float) $stub->amount, 2) : null,
                    'released_at' => $stub ? ($stub->claimed_at ?? $stub->released_at ?? $stub->certified_at)?->timezone('Asia/Manila')->format('Y-m-d') : null,
                ];
            });
    }

    public function stats(Collection $rows): array
    {
        return [
            ['label' => 'Terms', 'value' => (string) $rows->count()],
            ['label' => 'Verified Hours', 'value' => (string) round($rows->sum('verified_hours'), 2)],
            ['label' => 'Stipends Received', 'value' => (string) $rows->where('stipend', 'Released')->count()],
            ['label' => 'Total Received', 'value' => '₱' . number_format((float) $rows->sum('amount'), 0)],
        ];
    }
}
