<?php

namespace App\Reports;

use Illuminate\Support\Collection;

/**
 * One report as data: column definitions plus keyed rows. The same rows feed the
 * on-screen table and charts, the CSV and the PDF, so a download always matches
 * what was on screen. Stats are computed from the rows left after filtering, so
 * the KPI tiles follow the filters too.
 *
 * Column types: text, number, hours, money, percent, date, status.
 * `filterable` columns get a facet (dropdown) and can be grouped by in the chart;
 * `metric` columns can be summed per group instead of counting rows.
 */
abstract class ReportDataset
{
    public function __construct(protected readonly ReportScope $scope) {}

    abstract public function title(): string;

    abstract public function slug(): string;

    /** @return list<array{key:string,label:string,type:string,filterable:bool,metric:bool}> */
    abstract public function columns(): array;

    /** @return Collection<int, array<string, mixed>> */
    abstract public function rows(): Collection;

    /** @return list<array{label:string,value:string}> */
    abstract public function stats(Collection $rows): array;

    /** Most datasets are per term; a recipient's own logs span every term. */
    public function needsTerm(): bool
    {
        return true;
    }

    /** The chart's grouping when the viewer hasn't picked one. */
    public function defaultGroup(): ?string
    {
        return null;
    }

    /** Extra header lines for the PDF (e.g. the supervisor's office). */
    public function meta(): array
    {
        return [];
    }

    protected static function col(string $key, string $label, string $type = 'text', bool $filterable = false, bool $metric = false): array
    {
        return ['key' => $key, 'label' => $label, 'type' => $type, 'filterable' => $filterable, 'metric' => $metric];
    }

    protected static function name($user): ?string
    {
        return $user?->profile?->full_name ?? $user?->name;
    }

    protected static function label(?string $value): ?string
    {
        return $value === null || $value === '' ? null : ucwords(str_replace('_', ' ', $value));
    }

    protected static function hours($value): float
    {
        return round((float) ($value ?? 0), 2);
    }
}
