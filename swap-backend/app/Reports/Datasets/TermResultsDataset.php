<?php

namespace App\Reports\Datasets;

use App\Models\Application;
use App\Models\Assignment;
use App\Models\StipendHistory;
use App\Reports\ReportDataset;
use App\Support\ReportLabels;
use Illuminate\Support\Collection;

/**
 * How each placement of the term ended: hours, verdict, promissory note, end-of-term
 * report, stipend and renewal. Renewal = the student's first renewal application made
 * after this placement, for another term. A supervisor gets only their own students.
 */
class TermResultsDataset extends ReportDataset
{
    public function title(): string
    {
        return 'Term Results';
    }

    public function slug(): string
    {
        return 'term-results';
    }

    public function defaultGroup(): ?string
    {
        return 'verdict';
    }

    public function columns(): array
    {
        return [
            self::col('recipient', 'Recipient'),
            self::col('student_id', 'Student ID'),
            self::col('college', 'College', filterable: true),
            self::col('program', 'Program', filterable: true),
            self::col('year_level', 'Year Level', filterable: true),
            self::col('office', 'Office', filterable: true),
            self::col('supervisor', 'Supervisor', filterable: true),
            self::col('required_hours', 'Required Hours', 'hours', metric: true),
            self::col('verified_hours', 'Verified Hours', 'hours', metric: true),
            self::col('verdict', 'Verdict', 'status', filterable: true),
            self::col('deficient_hours', 'Deficient Hours', 'hours', metric: true),
            self::col('promissory', 'Promissory Note', 'status', filterable: true),
            self::col('report', 'End-of-Term Report', 'status', filterable: true),
            self::col('stipend', 'Stipend', 'status', filterable: true),
            self::col('renewal', 'Renewal', 'status', filterable: true),
        ];
    }

    public function rows(): Collection
    {
        $ay = $this->scope->academicYear;
        $sem = $this->scope->semester;

        $asgs = Assignment::whereHas('user')
            ->where('academic_year', $ay)->where('semester', $sem)
            ->whereIn('status', ['active', 'completed'])
            ->when($this->scope->isSupervisor(), fn ($q) => $q->visibleToSupervisor($this->scope->user))
            ->with(['user.profile', 'office', 'supervisor.profile', 'termReport'])
            ->withSum(['timeLogs as verified_sum' => fn ($q) => $q->where('status', 'verified')], 'duration_hours')
            ->withPromissoryFlags()
            ->get()
            ->sortBy(fn ($a) => self::name($a->user) ?? '')
            ->values();

        $userIds = $asgs->pluck('user_id');
        $stubs = StipendHistory::whereIn('user_id', $userIds)
            ->where('academic_year', $ay)->where('semester', $sem)
            ->where('status', '!=', StipendHistory::STATUS_VOID)
            ->get(['user_id'])->keyBy('user_id');
        $renewals = Application::whereIn('user_id', $userIds)
            ->where('type', 'renewal')
            ->where(fn ($q) => $q->where('academic_year', '!=', $ay)->orWhere('semester', '!=', $sem))
            ->orderBy('created_at')->get(['user_id', 'status', 'created_at'])
            ->groupBy('user_id');

        return $asgs->map(function (Assignment $a) use ($stubs, $renewals) {
            $renewal = ($renewals->get($a->user_id) ?? collect())->first(fn ($r) => $r->created_at >= $a->created_at);

            return [
                'recipient' => self::name($a->user),
                'student_id' => $a->user?->profile?->student_id_number,
                'college' => $a->user?->profile?->college,
                'program' => $a->user?->profile?->program,
                'year_level' => $a->user?->profile?->year_level ? 'Year ' . $a->user->profile->year_level : null,
                'office' => $a->office?->name,
                'supervisor' => self::name($a->supervisor),
                'required_hours' => (float) $a->required_hours,
                'verified_hours' => self::hours($a->verified_sum),
                'verdict' => self::label($a->term_status) ?? 'In Progress',
                'deficient_hours' => $a->deficient_hours !== null ? (float) $a->deficient_hours : null,
                'promissory' => ReportLabels::promissory($a),
                'report' => ReportLabels::termReport($a->termReport),
                // Any live stub is a release (legacy claimed/certified rows included).
                'stipend' => $stubs->has($a->user_id) ? 'Released' : 'Not Released',
                'renewal' => match ($renewal?->status) {
                    null => 'None',
                    'approved' => 'Approved',
                    'rejected' => 'Rejected',
                    default => 'Waiting',
                },
            ];
        });
    }

    public function stats(Collection $rows): array
    {
        return [
            ['label' => 'Qualified', 'value' => (string) $rows->where('verdict', 'Qualified')->count()],
            ['label' => 'Deficient', 'value' => (string) $rows->where('verdict', 'Deficient')->count()],
            ['label' => 'Notes Approved', 'value' => (string) $rows->where('promissory', 'Approved')->count()],
            ['label' => 'Renewed', 'value' => (string) $rows->where('renewal', 'Approved')->count()],
        ];
    }
}
