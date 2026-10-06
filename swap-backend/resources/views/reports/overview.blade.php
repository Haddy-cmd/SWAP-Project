@php
    /** @var array $o  AnalyticsService::getAdminOverview() */
    /** @var array $i  ProgramInsightsService::forTerm() */
    $tr = $i['term_results'];
    $rn = $i['renewals'];
    $st = $i['stipend'];
    $fn = $i['funnel'];
    $peso = fn ($v) => '₱' . number_format((float) $v, 2);
    $kpi = [
        ['Applications', $o['total_applications'] ?? 0],
        ['Active Recipients', $o['active_recipients'] ?? 0],
        ['Pending Applications', $o['pending_applications'] ?? 0],
        ['Avg Completion', number_format((float) ($o['avg_completion_rate'] ?? 0), 1) . '%'],
    ];
    $colleges = collect($o['applicants_by_college'] ?? [])->keyBy('college');
    $recipientsByCollege = collect($o['recipients_by_college'] ?? [])->keyBy('college');
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 16mm 14mm 18mm; }
        * { font-family: DejaVu Sans, sans-serif; }
        body { font-size: 9px; color: #13241A; margin: 0; }
        .footer { position: fixed; bottom: -12mm; left: 0; right: 0; font-size: 7.5px; color: #6F7B74; border-top: 1px solid #DCE0CF; padding-top: 4px; }
        .footer .r { float: right; }
        .pagenum:before { content: counter(page); }
        .hdr { border-bottom: 2px solid #1F5B3A; padding-bottom: 6px; }
        .hdr .u { font-size: 12px; font-weight: bold; color: #10331F; }
        .hdr .d { font-size: 8.5px; color: #6F7B74; }
        h1 { font-size: 17px; margin: 10px 0 4px; color: #10331F; }
        .meta { font-size: 8.5px; color: #4A5650; margin-bottom: 10px; }
        .meta b { color: #13241A; }
        .kpi { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .kpi td { border: 1px solid #DCE0CF; background: #F7F6EE; padding: 6px 8px; width: 25%; }
        .kpi .l { font-size: 7px; text-transform: uppercase; color: #6F7B74; letter-spacing: .04em; }
        .kpi .v { font-size: 16px; font-weight: bold; color: #10331F; }
        h2 { font-size: 10.5px; color: #10331F; margin: 12px 0 4px; border-bottom: 1px solid #DCE0CF; padding-bottom: 2px; }
        table.t { width: 100%; border-collapse: collapse; }
        table.t th { background: #16452B; color: #fff; font-size: 7.5px; text-align: left; padding: 4px; text-transform: uppercase; }
        table.t td { border-bottom: 1px solid #ECEFE2; padding: 3px 4px; font-size: 8.5px; }
        table.t td.n, table.t th.n { text-align: right; }
        .two { width: 100%; border-collapse: collapse; }
        .two > tbody > tr > td { width: 50%; vertical-align: top; padding-right: 8px; }
        .muted { color: #6F7B74; }
    </style>
</head>
<body>
<div class="footer">
    Program Overview · {{ $term }} · Generated {{ $generatedAt }} · Confidential — for internal use only
    <span class="r">Page <span class="pagenum"></span></span>
</div>

<div class="hdr">
    <div class="u">Mindanao State University — Marawi</div>
    <div class="d">Division of Student Affairs · Student Welfare Assistantship Program (SWAP) Portal</div>
</div>

<h1>Program Overview</h1>
<div class="meta"><b>Term:</b> {{ $term }} &nbsp;·&nbsp; <b>Prepared by:</b> {{ $preparedBy }} &nbsp;·&nbsp; <b>Generated:</b> {{ $generatedAt }}</div>

<table class="kpi"><tr>
    @foreach ($kpi as [$label, $value])
        <td><div class="l">{{ $label }}</div><div class="v">{{ $value }}</div></td>
    @endforeach
</tr></table>

<table class="two"><tr>
    <td>
        <h2>Term Results</h2>
        <table class="t">
            <tr><td>Placements</td><td class="n">{{ $tr['placements'] }}</td></tr>
            <tr><td>Qualified</td><td class="n">{{ $tr['qualified'] }}</td></tr>
            <tr><td>Deficient</td><td class="n">{{ $tr['deficient'] }}</td></tr>
            <tr><td>In progress</td><td class="n">{{ $tr['in_progress'] }}</td></tr>
            <tr><td>Total deficient hours</td><td class="n">{{ $tr['deficient_hours'] }}</td></tr>
            <tr><td>Promissory notes (approved / pending / rejected)</td><td class="n">{{ $tr['promissory']['approved'] }} / {{ $tr['promissory']['pending'] }} / {{ $tr['promissory']['rejected'] }}</td></tr>
        </table>
    </td>
    <td>
        <h2>Stipend</h2>
        <table class="t">
            <tr><td>Released</td><td class="n">{{ $st['released'] }}</td></tr>
            <tr><td>Amount released</td><td class="n">{{ $peso($st['released_amount']) }}</td></tr>
            <tr><td>Via promissory note</td><td class="n">{{ $st['via_promissory'] }}</td></tr>
            <tr><td>Voided</td><td class="n">{{ $st['voided'] }}</td></tr>
            <tr><td>Ready to release</td><td class="n">{{ $st['ready_to_release'] }}</td></tr>
            <tr><td>Payable but missing a requirement</td><td class="n">{{ $st['missing_requirements'] }}</td></tr>
        </table>
    </td>
</tr></table>

<table class="two"><tr>
    <td>
        <h2>Application Funnel</h2>
        <table class="t">
            <tr><td>Submitted</td><td class="n">{{ $fn['submitted'] }}</td></tr>
            <tr><td>Interviewed</td><td class="n">{{ $fn['interviewed'] }}</td></tr>
            <tr><td>Approved</td><td class="n">{{ $fn['approved'] }}</td></tr>
            <tr><td>Rejected</td><td class="n">{{ $fn['rejected'] }}</td></tr>
            <tr><td>Waiting</td><td class="n">{{ $fn['waiting'] }}</td></tr>
            <tr><td>Interview no-shows</td><td class="n">{{ $fn['no_shows'] }}</td></tr>
            <tr><td>Avg days to decision</td><td class="n">{{ $fn['avg_days_to_decision'] ?? '—' }}</td></tr>
        </table>
    </td>
    <td>
        <h2>Renewals</h2>
        <table class="t">
            <tr><td>Submitted</td><td class="n">{{ $rn['submitted'] }}</td></tr>
            <tr><td>Approved</td><td class="n">{{ $rn['approved'] }}</td></tr>
            <tr><td>Rejected</td><td class="n">{{ $rn['rejected'] }}</td></tr>
            <tr><td>Waiting</td><td class="n">{{ $rn['waiting'] }}</td></tr>
            <tr><td>Renewal rate @if ($rn['previous_term'])<span class="muted">(vs {{ $rn['previous_term'] }})</span>@endif</td><td class="n">{{ $rn['renewal_rate'] !== null ? $rn['renewal_rate'] . '%' : '—' }}</td></tr>
            @foreach ($rn['waiting_reasons'] as $w)
                <tr><td class="muted">&nbsp;&nbsp;Waiting: {{ $w['reason'] }}</td><td class="n">{{ $w['count'] }}</td></tr>
            @endforeach
        </table>
    </td>
</tr></table>

<h2>By College</h2>
@if ($colleges->isEmpty() && $recipientsByCollege->isEmpty())
    <p class="muted">No applicants or recipients this term.</p>
@else
    <table class="t">
        <thead><tr><th>College</th><th class="n">Applicants</th><th class="n">Approved</th><th class="n">Rejected</th><th class="n">Active Recipients</th></tr></thead>
        @foreach ($colleges->keys()->merge($recipientsByCollege->keys())->unique()->sort() as $college)
            <tr>
                <td>{{ $college ?: '(Blank)' }}</td>
                <td class="n">{{ $colleges[$college]['applicant_count'] ?? 0 }}</td>
                <td class="n">{{ $colleges[$college]['approved'] ?? 0 }}</td>
                <td class="n">{{ $colleges[$college]['rejected'] ?? 0 }}</td>
                <td class="n">{{ $recipientsByCollege[$college]['recipient_count'] ?? 0 }}</td>
            </tr>
        @endforeach
    </table>
@endif

<h2>Offices</h2>
@if (empty($i['offices']))
    <p class="muted">No active offices.</p>
@else
    <table class="t">
        <thead><tr><th>Office</th><th class="n">Capacity</th><th class="n">Filled</th><th class="n">Verified Hours</th><th class="n">Avg Completion</th></tr></thead>
        @foreach ($i['offices'] as $row)
            <tr>
                <td>{{ $row['office'] }}</td>
                <td class="n">{{ $row['capacity'] }}</td>
                <td class="n">{{ $row['filled'] }}</td>
                <td class="n">{{ $row['verified_hours'] }}</td>
                <td class="n">{{ $row['avg_completion'] !== null ? $row['avg_completion'] . '%' : '—' }}</td>
            </tr>
        @endforeach
    </table>
@endif

@if (!empty($i['workload']))
    <h2>Supervisor Workload</h2>
    <table class="t">
        <thead><tr><th>Supervisor</th><th class="n">Pending Logs</th><th class="n">Pending Hours</th><th class="n">Oldest (days)</th><th class="n">Verified</th><th class="n">Avg Verify (h)</th></tr></thead>
        @foreach ($i['workload'] as $w)
            <tr>
                <td>{{ $w['name'] }}</td>
                <td class="n">{{ $w['pending'] }}</td>
                <td class="n">{{ $w['pending_hours'] }}</td>
                <td class="n">{{ $w['oldest_pending_days'] ?? '—' }}</td>
                <td class="n">{{ $w['verified'] }}</td>
                <td class="n">{{ $w['avg_verify_hours'] ?? '—' }}</td>
            </tr>
        @endforeach
    </table>
@endif
</body>
</html>
