<?php

namespace App\Reports\Datasets;

use App\Models\TimeLog;
use App\Reports\ReportDataset;
use Illuminate\Support\Collection;

/** A recipient's own duty sessions across every term, newest first. */
class TimeLogsDataset extends ReportDataset
{
    public function title(): string
    {
        return 'My Service Hours';
    }

    public function slug(): string
    {
        return 'my-service-hours';
    }

    public function needsTerm(): bool
    {
        return false;
    }

    public function defaultGroup(): ?string
    {
        return 'month';
    }

    public function columns(): array
    {
        return [
            self::col('date', 'Date', 'date'),
            self::col('day', 'Day'),
            self::col('time_in', 'Time In'),
            self::col('time_out', 'Time Out'),
            self::col('hours', 'Hours', 'hours', metric: true),
            self::col('status', 'Status', 'status', filterable: true),
            self::col('term', 'Term', filterable: true),
            self::col('month', 'Month', filterable: true),
            self::col('office', 'Office', filterable: true),
            self::col('clock_out', 'Clock-out', filterable: true),
            self::col('flagged', 'Location Flagged', filterable: true),
            self::col('task', 'Task Description'),
            self::col('remarks', 'Remarks'),
        ];
    }

    public function rows(): Collection
    {
        $manila = fn ($t) => $t?->copy()->timezone('Asia/Manila');

        return TimeLog::where('user_id', $this->scope->user->id)
            ->with(['assignment.office', 'narrativeReport'])
            ->orderByDesc('time_in')->orderByDesc('id')
            ->get()
            ->map(function (TimeLog $l) use ($manila) {
                $in = $manila($l->time_in);
                $out = $manila($l->time_out);
                $a = $l->assignment;

                return [
                    'date' => $l->date?->toDateString(),
                    'day' => $l->date?->format('l'),
                    'time_in' => $in?->format('g:i A'),
                    'time_out' => $out?->format('g:i A'),
                    'hours' => $l->time_out ? self::hours($l->duration_hours) : null,
                    'status' => self::label($l->status),
                    'term' => $a ? "{$a->semester} {$a->academic_year}" : null,
                    'month' => $l->date?->format('Y-m · F'),
                    'office' => $a?->office?->name,
                    'clock_out' => match (true) {
                        (bool) $l->is_manual => 'Added by Supervisor',
                        !$l->time_out => 'Still Open',
                        in_array($l->clocked_out_reason, ['auto', 'auto_dedup'], true) => 'Automatic (left office)',
                        $l->clocked_out_reason === 'auto_stale' => 'Automatic (12-hour limit)',
                        default => 'By You',
                    },
                    'flagged' => $l->location_flagged ? 'Yes' : 'No',
                    'task' => $l->narrativeReport?->content,
                    'remarks' => $l->status === 'rejected' ? $l->rejection_reason : ($l->is_manual ? $l->manual_reason : null),
                ];
            });
    }

    public function stats(Collection $rows): array
    {
        return [
            ['label' => 'Logs', 'value' => (string) $rows->count()],
            ['label' => 'Verified Hours', 'value' => (string) round($rows->where('status', 'Verified')->sum('hours'), 2)],
            ['label' => 'Pending Hours', 'value' => (string) round($rows->where('status', 'Pending Verification')->sum('hours'), 2)],
            ['label' => 'Days on Duty', 'value' => (string) $rows->where('status', '!=', 'Rejected')->whereNotNull('hours')->pluck('date')->unique()->count()],
        ];
    }
}
