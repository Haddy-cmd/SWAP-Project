<?php

namespace App\Support;

use App\Models\Assignment;
use App\Models\TermReport;

/** The words the roster, term results and their exports print for a placement's state. */
final class ReportLabels
{
    /** End-of-term report state. */
    public static function termReport(?TermReport $report): string
    {
        return match (true) {
            !$report || !$report->submitted_at => 'Missing',
            !$report->reviewed_at => 'Submitted',
            default => $report->renewal_eligible ? 'Accepted · Eligible' : 'Accepted · Not eligible',
        };
    }

    /** Approved / Pending from `withPromissoryFlags()`, else null (no note). */
    public static function promissory(Assignment $a): ?string
    {
        return match (true) {
            (bool) $a->has_approved_promissory => 'Approved',
            (bool) $a->has_pending_promissory => 'Pending',
            default => null,
        };
    }
}
