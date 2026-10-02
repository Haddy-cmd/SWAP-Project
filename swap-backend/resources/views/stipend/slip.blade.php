@php
    /** @var \App\Models\StipendHistory $stipend */
    $recipient = $stipend->recipient;
    $name = $recipient?->profile?->full_name ?? $recipient?->name ?? '________________________';
    $sid = $recipient?->profile?->student_id_number;
    $amount = number_format((float) $stipend->amount, 2);
    $period = trim(($stipend->period_label ? $stipend->period_label . ' of the ' : '') . $stipend->semester . ' ' . $stipend->academic_year);
    $control = $stipend->control_number ?? '—';
    $date = optional($stipend->certified_at)->timezone('Asia/Manila')->format('F j, Y') ?? '';

    // Released through an approved promissory note: the stub states the shortfall
    // the note covers instead of certifying completed hours.
    $hrs = fn ($h) => rtrim(rtrim(number_format((float) $h, 2), '0'), '.');
    $promissory = $stipend->via_promissory && $stipend->deficient_hours !== null;
    $deficient = $promissory ? $hrs($stipend->deficient_hours) : null;
    $requiredHrs = $promissory && $stipend->required_hours !== null ? $hrs($stipend->required_hours) : null;
    $renderedHrs = $requiredHrs !== null ? $hrs(max(0, (float) $stipend->required_hours - (float) $stipend->deficient_hours)) : null;
    $makeupDue = $stipend->makeup_deadline?->format('F j, Y');

    $sig = fn (string $role) => $stipend->signatures->firstWhere('signatory_role', $role);
    // Drawn specimen embedded as ink. Base64 data-URI keeps DomPDF self-contained
    // (no remote URLs); a missing/unreadable file falls back to the typed line.
    $ink = function ($signature) {
        if (!$signature || $signature->method !== 'drawn' || !$signature->signature_image_path) return '';
        try {
            $disk = \Illuminate\Support\Facades\Storage::disk(config('filesystems.documents_disk', 'public'));
            if (!$disk->exists($signature->signature_image_path)) return '';
            $mime = $disk->mimeType($signature->signature_image_path) ?: 'image/png';
            $data = base64_encode($disk->get($signature->signature_image_path));
            return '<div class="sigink"><img src="data:' . e($mime) . ';base64,' . $data . '"></div>';
        } catch (\Throwable) {
            return '';
        }
    };
    // $role feeds the title line from the single SignatoryTitles definition:
    // fixed policy for mentor/beneficiary, the admin's profile title for director.
    // $fallbackName pre-prints a "to be signed by" block (empty ink cell + name +
    // title, no gray placeholder) when no signature row exists yet.
    $line = function ($signature, $role = null, $fallbackName = null) use ($ink) {
        if (!$signature) {
            if ($fallbackName === null) return '<span style="color:#999">(not yet signed)</span>';
            $title = $role ? \App\Support\SignatoryTitles::for($role) : null;
            $out = '<div class="sigink"></div>' . e($fallbackName);
            if ($title) $out .= '<br><span class="sigtitle">' . e($title) . '</span>';
            return $out;
        }
        $when = optional($signature->signed_at)->timezone('Asia/Manila')->format('M j, Y g:i A');
        $out = $ink($signature) . e($signature->printed_name);
        $title = $role ? \App\Support\SignatoryTitles::for($role, $signature->user) : null;
        if ($title) $out .= '<br><span class="sigtitle">' . e($title) . '</span>';
        return $out . '<br><span style="font-size:8px;color:#555">signed ' . e($when) . ' · ' . e($signature->method) . '</span>';
    };
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { font-size: 11px; color: #111; margin: 0; }
        .part { border: 1px solid #333; padding: 12px 16px; margin-bottom: 10px; }
        .cut { border-top: 1px dashed #777; text-align: center; font-size: 8px; color: #777; margin: 4px 0 10px; }
        .hdr { text-align: center; line-height: 1.35; }
        .hdr .u { font-weight: bold; font-size: 13px; }
        .title { text-align: center; font-weight: bold; font-size: 13px; margin: 6px 0 2px; }
        .sub { text-align: center; font-style: italic; font-size: 10px; margin-bottom: 8px; }
        .meta td { font-size: 10px; padding: 1px 0; }
        .body { margin: 8px 0; line-height: 1.5; }
        .sigrow { width: 100%; margin-top: 18px; }
        .sigrow td { width: 50%; vertical-align: bottom; padding: 0 10px; }
        .sigbox { border-top: 1px solid #111; padding-top: 2px; font-size: 10px; }
        /* Fixed signing cell: both columns reserve identical space above the rule,
           so ink always sits in the designated area however large the stroke is. */
        .sigink { height: 34px; line-height: 34px; }
        .sigink img { max-height: 32px; max-width: 160px; vertical-align: bottom; }
        .sigtitle { font-size: 9px; color: #333; }
        /* Borderless signing block: with ink signatures the role caps and rule
           lines are redundant — ink + name + title + timestamp is the block. */
        .sigfree { padding-top: 2px; font-size: 10px; }
        .role { font-size: 8px; color: #555; text-transform: uppercase; letter-spacing: .04em; }
        .copytag { float: right; font-size: 8px; font-weight: bold; color: #8E1B1E; border: 1px solid #8E1B1E; padding: 1px 5px; }
        .void { color: #B0562F; font-weight: bold; }
    </style>
</head>
<body>

@if ($stipend->status === 'void')
    <p class="void">VOID — {{ $stipend->void_reason }}</p>
@endif

{{-- ── PART 1 · ACKNOWLEDGMENT RECEIPT (→ Banking Office) ── --}}
<div class="part">
    <span class="copytag">DSA / BANKING COPY</span>
    <div class="hdr">
        Republic of the Philippines<br>
        <span class="u">Mindanao State University</span><br>
        Marawi City<br>
        <b>Division of Student Affairs</b>
    </div>
    <div class="title">STUDENT WELFARE ASSISTANTSHIP PROGRAM</div>
    <div class="sub">Acknowledgment Receipt</div>

    <table width="100%" class="meta">
        <tr>
            <td>Control Number: <b>{{ $control }}</b></td>
            <td align="right">Date: {{ $date }}</td>
        </tr>
    </table>

    <table width="100%">
        <tr>
            <td style="vertical-align: top;">
                <div class="body">
                    @if ($promissory)
                        This is to certify that Mr./Ms. <b>{{ $name }}</b>@if ($sid) (Student ID <b>{{ $sid }}</b>)@endif is a bonafide beneficiary of the
                        Student Welfare Assistantship Program (SWAP) and has rendered
                        @if ($requiredHrs !== null) <b>{{ $renderedHrs }}</b> of the <b>{{ $requiredHrs }}</b> @else the @endif
                        duty hours required for <b>{{ $period }}</b>, with a deficiency of <b>{{ $deficient }} hours</b>
                        covered by approved promissory note #{{ $stipend->promissory_note_id }}@if ($makeupDue) (makeup due {{ $makeupDue }})@endif.
                    @else
                        This is to certify that Mr./Ms. <b>{{ $name }}</b>@if ($sid) (Student ID <b>{{ $sid }}</b>)@endif is a bonafide beneficiary of the
                        Student Welfare Assistantship Program (SWAP) and has completed the duty hours required for
                        <b>{{ $period }}</b>.
                    @endif
                </div>
            </td>
            @if (!empty($claimQr))
                {{-- The releasing officer scans this to verify the stub and record the payout. --}}
                <td style="width: 96px; text-align: center; vertical-align: top; padding-left: 10px;">
                    <img src="{{ $claimQr }}" style="width: 84px; height: 84px;" alt="">
                    <div style="font-size: 7px; line-height: 1.25; color: #333;">Banking Office:<br>scan to verify and release</div>
                </td>
            @endif
        </tr>
    </table>

    <table class="sigrow">
        <tr>
            <td><div class="sigfree">{!! $line($sig('supervisor'), 'supervisor') !!}</div></td>
            <td><div class="sigfree">{!! $line($sig('director'), 'director') !!}</div></td>
        </tr>
    </table>
</div>

<div class="cut">— — — — — — — — — —  cut here  — — — — — — — — — —</div>

{{-- ── PART 2 · RETURN SLIP (→ retained by DSA) ── --}}
<div class="part">
    <span class="copytag">DSA COPY</span>
    <div class="title">SWAP — Return Slip</div>
    <table width="100%" class="meta">
        <tr><td>Control Number: <b>{{ $control }}</b></td><td align="right">Amount: <b>₱{{ $amount }}</b></td></tr>
    </table>
    <div class="body">
        Mr./Ms. <b>{{ $name }}</b>@if ($sid) (Student ID <b>{{ $sid }}</b>)@endif has received the amount of <b>₱{{ $amount }}</b> as payment for
        the SWAP Beneficiary allowance for <b>{{ $period }}</b>.
    </div>
    @if ($promissory)
        <div class="body">Deficiency: <b>{{ $deficient }} hrs</b> · promissory note #{{ $stipend->promissory_note_id }}@if ($makeupDue) · makeup due {{ $makeupDue }}@endif</div>
    @endif
    <table class="sigrow">
        <tr>
            <td><div class="sigfree">{!! $line($sig('beneficiary'), 'beneficiary', $name) !!}</div></td>
            <td><div class="sigbox"><span class="role">Releasing Officer / Cashier</span><br>{!! $line($sig('releasing_officer')) !!}</div></td>
        </tr>
    </table>
</div>

<div class="cut">— — — — — — — — — —  cut here  — — — — — — — — — —</div>

{{-- ── PART 3 · RECEIVING SLIP (→ kept by student) ── --}}
<div class="part">
    <span class="copytag">STUDENT COPY</span>
    <div class="title">SWAP — Receiving Slip</div>
    <table width="100%" class="meta">
        <tr><td>Control Number: <b>{{ $control }}</b></td><td align="right">Amount: <b>₱{{ $amount }}</b></td></tr>
    </table>
    <div class="body">
        Mr./Ms. <b>{{ $name }}</b>@if ($sid) (Student ID <b>{{ $sid }}</b>)@endif has received the amount of <b>₱{{ $amount }}</b> as payment for
        the SWAP Beneficiary allowance for <b>{{ $period }}</b>.
    </div>
    @if ($promissory)
        <div class="body">Deficiency: <b>{{ $deficient }} hrs</b> · promissory note #{{ $stipend->promissory_note_id }}@if ($makeupDue) · makeup due {{ $makeupDue }}@endif</div>
    @endif
    <table class="sigrow">
        <tr>
            <td><div class="sigfree">{!! $line($sig('beneficiary'), 'beneficiary', $name) !!}</div></td>
            <td><div class="sigbox"><span class="role">Releasing Officer / Cashier</span><br>{!! $line($sig('releasing_officer')) !!}</div></td>
        </tr>
    </table>
</div>

</body>
</html>
