<?php

namespace App\Reports\Datasets;

use App\Models\Assignment;
use App\Models\Office;
use App\Models\User;
use App\Reports\ReportDataset;
use Illuminate\Support\Collection;

/** Each host office with its capacity, this term's active recipients and its supervisors. */
class OfficesDataset extends ReportDataset
{
    public function title(): string
    {
        return 'Office Assignment';
    }

    public function slug(): string
    {
        return 'office-assignments';
    }

    public function defaultGroup(): ?string
    {
        return 'availability';
    }

    /** No term: each office's currently active recipients, whatever their term. */
    public function needsTerm(): bool
    {
        return false;
    }

    public function columns(): array
    {
        return [
            self::col('office', 'Office'),
            // The office head is its supervisor(s) (Admin → Offices → Supervisor).
            self::col('head', 'Head (Supervisor)'),
            self::col('location', 'Location'),
            self::col('capacity', 'Capacity', 'number', metric: true),
            self::col('active_recipients', 'Active Recipients', 'number', metric: true),
            self::col('fill_rate', 'Filled', 'percent'),
            self::col('availability', 'Availability', 'status', filterable: true),
            self::col('supervisors', 'Supervisors', 'number', metric: true),
        ];
    }

    public function rows(): Collection
    {
        $active = Assignment::whereHas('user')
            ->tap(fn ($q) => $this->inTerm($q))
            ->where('status', 'active')
            ->selectRaw('office_id, COUNT(*) as n')->groupBy('office_id')->pluck('n', 'office_id');
        $names = User::where('role', 'supervisor')->whereNotNull('office_id')->orderBy('name')
            ->get(['name', 'office_id'])->groupBy('office_id')->map(fn ($g) => $g->pluck('name'));

        return Office::orderBy('name')->get()->map(function (Office $o) use ($active, $names) {
            $n = (int) ($active[$o->id] ?? 0);
            $cap = (int) $o->max_recipients;
            $heads = $names[$o->id] ?? collect();

            return [
                'office' => $o->name,
                'head' => $heads->isNotEmpty() ? $heads->implode(', ') : null,
                'location' => $o->location,
                'capacity' => $cap,
                'active_recipients' => $n,
                'fill_rate' => $cap > 0 ? round($n / $cap * 100, 1) : null,
                'availability' => match (true) {
                    $cap > 0 && $n >= $cap => 'Full',
                    $n === 0 => 'Empty',
                    default => 'Has Slots',
                },
                'supervisors' => $heads->count(),
            ];
        });
    }

    public function stats(Collection $rows): array
    {
        return [
            ['label' => 'Offices', 'value' => (string) $rows->count()],
            ['label' => 'Assigned', 'value' => (string) $rows->sum('active_recipients')],
            ['label' => 'Full Offices', 'value' => (string) $rows->where('availability', 'Full')->count()],
            ['label' => 'Supervisors', 'value' => (string) $rows->sum('supervisors')],
        ];
    }
}
