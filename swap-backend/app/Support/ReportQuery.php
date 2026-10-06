<?php

namespace App\Support;

use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * The viewer's filters, search, sort and chart grouping for one report, applied to
 * the dataset's rows in one place. The preview, the CSV and the PDF all go through
 * apply(), so the download is exactly what was on screen. Rows are filtered in PHP:
 * a term has hundreds of placements, not millions, and one code path keeps the
 * preview and the export identical.
 *
 * Filters: OR within a column, AND across columns. Values are compared as the text
 * the table shows; an empty cell is the "(Blank)" value.
 */
final class ReportQuery
{
    public const BLANK = '(Blank)';

    private const NUMERIC = ['number', 'hours', 'money', 'percent'];

    /** @param array<string, list<string>> $filters */
    public function __construct(
        public readonly array $filters = [],
        public readonly ?string $search = null,
        public readonly ?string $sort = null,
        public readonly string $dir = 'asc',
        public readonly ?string $groupBy = null,
        public readonly ?string $metric = null,
    ) {}

    /**
     * Build from validated input, refusing any column the dataset doesn't have or
     * doesn't allow for that use (422, like any other validation error).
     */
    public static function fromInput(array $input, array $columns, ?string $defaultGroup = null): self
    {
        $byKey = collect($columns)->keyBy('key');
        $errors = [];

        $filters = [];
        foreach (($input['filters'] ?? []) as $key => $values) {
            if (!($byKey[$key]['filterable'] ?? false)) {
                $errors["filters.$key"] = ["This report can't be filtered by \"$key\"."];
                continue;
            }
            $values = array_values(array_unique(array_filter(array_map('strval', (array) $values), fn ($v) => $v !== '')));
            if ($values) {
                $filters[$key] = $values;
            }
        }

        $sort = $input['sort'] ?? null;
        if ($sort !== null && !$byKey->has($sort)) {
            $errors['sort'] = ["This report can't be sorted by \"$sort\"."];
        }

        $group = $input['group_by'] ?? $defaultGroup;
        if ($group !== null && !($byKey[$group]['filterable'] ?? false)) {
            $errors['group_by'] = ["This report can't be grouped by \"$group\"."];
        }

        $metric = $input['metric'] ?? null;
        if ($metric !== null && !($byKey[$metric]['metric'] ?? false)) {
            $errors['metric'] = ["\"$metric\" can't be totalled in this report."];
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        $search = trim((string) ($input['search'] ?? ''));

        return new self($filters, $search === '' ? null : $search, $sort, ($input['dir'] ?? 'asc') === 'desc' ? 'desc' : 'asc', $group, $metric);
    }

    /** The text a cell is filtered and grouped by. */
    public static function key(mixed $value): string
    {
        return $value === null || $value === '' ? self::BLANK : (string) $value;
    }

    public function apply(Collection $rows, array $columns): Collection
    {
        foreach ($this->filters as $key => $values) {
            $rows = $rows->filter(fn ($r) => in_array(self::key($r[$key] ?? null), $values, true));
        }

        if ($this->search !== null) {
            $needle = mb_strtolower($this->search);
            $text = collect($columns)->whereIn('type', ['text', 'status', 'date'])->pluck('key')->all();
            $rows = $rows->filter(function ($r) use ($needle, $text) {
                foreach ($text as $k) {
                    if (str_contains(mb_strtolower((string) ($r[$k] ?? '')), $needle)) {
                        return true;
                    }
                }

                return false;
            });
        }

        if ($this->sort !== null) {
            $numeric = in_array(collect($columns)->firstWhere('key', $this->sort)['type'] ?? 'text', self::NUMERIC, true);
            $sign = $this->dir === 'desc' ? -1 : 1;
            $rows = $rows->sort(function ($a, $b) use ($numeric, $sign) {
                $x = $a[$this->sort] ?? null;
                $y = $b[$this->sort] ?? null;
                // Blanks go last whichever way the column is sorted.
                $xb = $x === null || $x === '';
                $yb = $y === null || $y === '';
                if ($xb || $yb) {
                    return $xb <=> $yb;
                }

                return $sign * ($numeric ? ((float) $x <=> (float) $y) : strnatcasecmp((string) $x, (string) $y));
            });
        }

        return $rows->values();
    }

    /**
     * Each filterable column's values with how many rows carry them, over the
     * unfiltered rows, so a dropdown always offers every option of the term.
     *
     * @return array<string, list<array{value:string,count:int}>>
     */
    public function facets(Collection $rows, array $columns): array
    {
        $out = [];
        foreach ($columns as $c) {
            if (!$c['filterable']) {
                continue;
            }
            $out[$c['key']] = $rows->countBy(fn ($r) => self::key($r[$c['key']] ?? null))
                ->map(fn ($n, $v) => ['value' => (string) $v, 'count' => $n])
                ->sortBy('value', SORT_NATURAL | SORT_FLAG_CASE)->values()->all();
        }

        return $out;
    }

    /**
     * The chart: one bar per value of the group column, sized by the row count or
     * by the sum of the metric column, largest first.
     *
     * @return list<array{label:string,value:float|int,count:int}>
     */
    public function groups(Collection $rows): array
    {
        if ($this->groupBy === null) {
            return [];
        }

        return $rows->groupBy(fn ($r) => self::key($r[$this->groupBy] ?? null))
            ->map(fn (Collection $g, $label) => [
                'label' => (string) $label,
                'value' => $this->metric ? round($g->sum(fn ($r) => (float) ($r[$this->metric] ?? 0)), 2) : $g->count(),
                'count' => $g->count(),
            ])
            ->sortByDesc('value')->values()->all();
    }

    /**
     * What was applied, in words, for the PDF header and the audit log.
     *
     * @return list<string>
     */
    public function describe(array $columns): array
    {
        $label = fn ($k) => collect($columns)->firstWhere('key', $k)['label'] ?? $k;
        $parts = [];
        foreach ($this->filters as $key => $values) {
            $parts[] = $label($key) . ' = ' . implode(', ', $values);
        }
        if ($this->search !== null) {
            $parts[] = "Search \"{$this->search}\"";
        }
        if ($this->sort !== null) {
            $parts[] = 'Sorted by ' . $label($this->sort) . ($this->dir === 'desc' ? ' ↓' : ' ↑');
        }

        return $parts;
    }

    public function toArray(): array
    {
        return array_filter([
            'filters' => $this->filters ?: null,
            'search' => $this->search,
            'sort' => $this->sort,
            'dir' => $this->sort ? $this->dir : null,
            'group_by' => $this->groupBy,
            'metric' => $this->metric,
        ], fn ($v) => $v !== null);
    }
}
