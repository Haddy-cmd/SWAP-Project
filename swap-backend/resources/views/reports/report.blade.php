@php
    /** @var array $report */
    use App\Services\ReportPdfService;

    $columns = $report['columns'];
    $groups = array_slice($report['groups'], 0, 12);
    $groupLabel = collect($columns)->firstWhere('key', $report['group_by'])['label'] ?? null;
    $metricCol = collect($columns)->firstWhere('key', $report['metric']);
    $metricType = $metricCol['type'] ?? 'number';
    $max = max(1, ...array_map(fn ($g) => (float) $g['value'], $groups ?: [['value' => 1]]));
    $palette = ['#1F5B3A', '#D4AE22', '#A31A1E', '#2F5D8A', '#1F8163', '#6B4E9A', '#8C968F'];
    $statusColor = [
        'Approved' => '#145643', 'Active' => '#145643', 'Released' => '#145643', 'Qualified' => '#145643', 'Verified' => '#145643',
        'Complete' => '#145643', 'On Track' => '#145643', 'Accepted · Eligible' => '#145643',
        'Rejected' => '#B42318', 'Deficient' => '#B42318', 'Void' => '#B42318', 'Behind' => '#B42318', 'Missing' => '#B42318',
        'Accepted · Not eligible' => '#B42318', 'Full' => '#B42318',
        'Pending' => '#B45309', 'Pending Verification' => '#B45309', 'Under Review' => '#B45309', 'Waiting' => '#B45309', 'Submitted' => '#2F5D8A',
    ];
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 16mm 12mm 18mm; }
        * { font-family: DejaVu Sans, sans-serif; }
        body { font-size: 9px; color: #13241A; margin: 0; }
        .footer { position: fixed; bottom: -12mm; left: 0; right: 0; font-size: 7.5px; color: #6F7B74; border-top: 1px solid #DCE0CF; padding-top: 4px; }
        .footer .r { float: right; }
        .pagenum:before { content: counter(page); }
        .hdr { border-bottom: 2px solid #1F5B3A; padding-bottom: 6px; }
        .hdr .u { font-size: 12px; font-weight: bold; color: #10331F; }
        .hdr .d { font-size: 8.5px; color: #6F7B74; }
        h1 { font-size: 17px; margin: 10px 0 4px; color: #10331F; }
        .meta { font-size: 8.5px; color: #4A5650; margin-bottom: 6px; }
        .meta b { color: #13241A; }
        .filters { background: #F7F6EE; border: 1px solid #DCE0CF; padding: 5px 8px; font-size: 8.5px; margin-bottom: 8px; }
        .stats { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .stats td { border: 1px solid #DCE0CF; background: #F7F6EE; padding: 5px 8px; }
        .stats .l { font-size: 7px; text-transform: uppercase; color: #6F7B74; letter-spacing: .04em; }
        .stats .v { font-size: 14px; font-weight: bold; color: #10331F; }
        .section { font-size: 10px; font-weight: bold; color: #10331F; margin: 8px 0 4px; }
        .bars { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .bars td { padding: 2px 4px; font-size: 8.5px; vertical-align: middle; }
        .bars .lbl { width: 30%; }
        .bars .track { background: #ECEFE2; height: 10px; }
        .bars .fill { height: 10px; }
        .bars .num { width: 12%; text-align: right; font-weight: bold; }
        table.data { width: 100%; border-collapse: collapse; }
        table.data th { background: #16452B; color: #fff; font-size: 7.5px; text-align: left; padding: 4px 4px; text-transform: uppercase; letter-spacing: .03em; }
        table.data td { border-bottom: 1px solid #ECEFE2; padding: 3px 4px; font-size: 8px; }
        table.data tr:nth-child(even) td { background: #FAFAF5; }
        table.data td.n { text-align: right; white-space: nowrap; }
        .empty { padding: 14px; text-align: center; color: #6F7B74; border: 1px dashed #CAD2BC; }
    </style>
</head>
<body>
<div class="footer">
    {{ $report['title'] }} · Generated {{ $generatedAt }} · Confidential — for internal use only
    <span class="r">Page <span class="pagenum"></span></span>
</div>

<div class="hdr">
    <div class="u">Mindanao State University — Marawi</div>
    <div class="d">Division of Student Affairs · Student Welfare Assistantship Program (SWAP) Portal</div>
</div>

<h1>{{ $report['title'] }}</h1>
<div class="meta">
    @if ($report['term'])<b>Term:</b> {{ $report['term'] }} &nbsp;·&nbsp; @endif
    @foreach ($report['meta'] as $k => $v)<b>{{ $k }}:</b> {{ $v }} &nbsp;·&nbsp; @endforeach
    <b>Prepared by:</b> {{ $preparedBy }} &nbsp;·&nbsp;
    <b>Generated:</b> {{ $generatedAt }} &nbsp;·&nbsp;
    <b>Records:</b> {{ count($report['rows']) }}@if (count($report['rows']) !== $report['total_rows']) of {{ $report['total_rows'] }}@endif
</div>

<div class="filters">
    <b>Filters applied:</b>
    {{ $report['filters_applied'] ? implode(' · ', $report['filters_applied']) : 'None — all records' }}
</div>

@if ($report['stats'])
    <table class="stats"><tr>
        @foreach ($report['stats'] as $s)
            <td><div class="l">{{ $s['label'] }}</div><div class="v">{{ $s['value'] }}</div></td>
        @endforeach
    </tr></table>
@endif

@if (($includeChart ?? true) && $groups && $groupLabel)
    <div class="section">{{ $metricCol ? $metricCol['label'] : 'Records' }} by {{ $groupLabel }}</div>
    <table class="bars">
        @foreach ($groups as $i => $g)
            <tr>
                <td class="lbl">{{ $g['label'] }}</td>
                <td><div class="track"><div class="fill" style="width: {{ round((float) $g['value'] / $max * 100, 1) }}%; background: {{ $palette[$i % count($palette)] }};"></div></div></td>
                <td class="num">{{ $metricCol ? ReportPdfService::cell($g['value'], $metricType) : $g['value'] }}</td>
            </tr>
        @endforeach
    </table>
@endif

<div class="section">Records</div>
@if (count($report['rows']) === 0)
    <div class="empty">No records match these filters.</div>
@else
    <table class="data">
        <thead><tr>
            @foreach ($columns as $c)<th>{{ $c['label'] }}</th>@endforeach
        </tr></thead>
        <tbody>
        @foreach ($report['rows'] as $row)
            <tr>
                @foreach ($columns as $c)
                    @php $text = ReportPdfService::cell($row[$c['key']] ?? null, $c['type']); @endphp
                    @if (in_array($c['type'], ['number', 'hours', 'money', 'percent'], true))
                        <td class="n">{{ $text }}</td>
                    @elseif ($c['type'] === 'status' && isset($statusColor[$text]))
                        <td style="color: {{ $statusColor[$text] }}; font-weight: bold;">{{ $text }}</td>
                    @else
                        <td>{{ $text }}</td>
                    @endif
                @endforeach
            </tr>
        @endforeach
        </tbody>
    </table>
@endif
</body>
</html>
