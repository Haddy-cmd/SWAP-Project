<?php

namespace App\Reports\Datasets;

use App\Models\Assignment;
use App\Models\StipendHistory;
use App\Reports\ReportDataset;
use Illuminate\Support\Collection;

/** Every stipend stub of the term, released or void, with where the student served. */
class StipendDataset extends ReportDataset
{
    public function title(): string
    {
        return 'Stipend Disbursement';
    }

    public function slug(): string
    {
        return 'stipend-disbursement';
    }

    public function defaultGroup(): ?string
    {
        return 'college';
    }

    public function columns(): array
    {
        return [
            self::col('recipient', 'Recipient'),
            self::col('email', 'Email'),
            self::col('student_id', 'Student ID'),
            self::col('college', 'College', filterable: true),
            self::col('office', 'Office', filterable: true),
            self::col('control_number', 'Control No.'),
            self::col('amount', 'Amount', 'money', metric: true),
            self::col('status', 'Status', 'status', filterable: true),
            self::col('period', 'Period'),
            self::col('released_at', 'Released At', 'date'),
            self::col('via_promissory', 'Via Promissory', filterable: true),
            self::col('deficient_hours', 'Deficient Hours', 'hours', metric: true),
        ];
    }

    public function rows(): Collection
    {
        $stipends = StipendHistory::whereHas('recipient')
            ->where('academic_year', $this->scope->academicYear)->where('semester', $this->scope->semester)
            ->with('recipient.profile')->orderByDesc('created_at')->get();

        // A stub has no assignment link; the student's placement for the same term names the office.
        $offices = Assignment::whereIn('user_id', $stipends->pluck('user_id'))
            ->where('academic_year', $this->scope->academicYear)->where('semester', $this->scope->semester)
            ->with('office')->orderBy('id')->get()
            ->mapWithKeys(fn ($a) => [$a->user_id => $a->office?->name]);

        return $stipends->map(fn (StipendHistory $s) => [
            'recipient' => self::name($s->recipient),
            'email' => $s->recipient?->email,
            'student_id' => $s->recipient?->profile?->student_id_number,
            'college' => $s->recipient?->profile?->college,
            'office' => $offices[$s->user_id] ?? null,
            'control_number' => $s->control_number,
            'amount' => round((float) $s->amount, 2),
            // A release is final (2026-10-05): every live stub counts as released, legacy
            // Banking Office payouts (`claimed`) included; void ones don't count.
            'status' => $s->status === StipendHistory::STATUS_VOID ? 'Void' : 'Released',
            'period' => $s->period_label,
            'released_at' => ($s->released_at ?? $s->claimed_at ?? $s->certified_at)?->timezone('Asia/Manila')->format('Y-m-d H:i'),
            'via_promissory' => $s->via_promissory ? 'Yes' : 'No',
            'deficient_hours' => $s->deficient_hours !== null ? (float) $s->deficient_hours : null,
        ]);
    }

    public function stats(Collection $rows): array
    {
        $released = $rows->where('status', 'Released');

        return [
            ['label' => 'Total Released', 'value' => '₱' . number_format((float) $released->sum('amount'), 0)],
            ['label' => 'Recipients', 'value' => (string) $released->count()],
            ['label' => 'Via Promissory', 'value' => (string) $released->where('via_promissory', 'Yes')->count()],
            ['label' => 'Voided', 'value' => (string) $rows->where('status', 'Void')->count()],
        ];
    }
}
