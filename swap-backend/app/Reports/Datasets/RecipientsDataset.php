<?php

namespace App\Reports\Datasets;

use App\Models\Assignment;
use App\Reports\ReportDataset;
use Illuminate\Support\Collection;

/** Every placement of the term with its hours, office, supervisor and verdict. */
class RecipientsDataset extends ReportDataset
{
    public function title(): string
    {
        return 'Recipients & Hours';
    }

    public function slug(): string
    {
        return 'recipients-hours';
    }

    public function defaultGroup(): ?string
    {
        return 'office';
    }

    public function columns(): array
    {
        return [
            self::col('recipient', 'Recipient'),
            self::col('email', 'Email'),
            self::col('student_id', 'Student ID'),
            self::col('college', 'College', filterable: true),
            self::col('program', 'Program', filterable: true),
            self::col('office', 'Office', filterable: true),
            self::col('supervisor', 'Supervisor', filterable: true),
            self::col('required_hours', 'Required Hours', 'hours', metric: true),
            self::col('verified_hours', 'Verified Hours', 'hours', metric: true),
            self::col('remaining_hours', 'Remaining', 'hours', metric: true),
            self::col('percent', '% Complete', 'percent'),
            self::col('status', 'Status', 'status', filterable: true),
            self::col('term_status', 'Term Status', 'status', filterable: true),
            self::col('deficient_hours', 'Deficient Hours', 'hours', metric: true),
        ];
    }

    public function rows(): Collection
    {
        return Assignment::whereHas('user')
            ->where('academic_year', $this->scope->academicYear)->where('semester', $this->scope->semester)
            ->with(['user.profile', 'office', 'supervisor.profile'])
            ->withSum(['timeLogs as verified_sum' => fn ($q) => $q->where('status', 'verified')], 'duration_hours')
            ->orderBy('office_id')->get()
            ->map(function (Assignment $a) {
                $verified = self::hours($a->verified_sum);
                $required = (float) $a->required_hours;

                return [
                    'recipient' => self::name($a->user),
                    'email' => $a->user?->email,
                    'student_id' => $a->user?->profile?->student_id_number,
                    'college' => $a->user?->profile?->college,
                    'program' => $a->user?->profile?->program,
                    'office' => $a->office?->name,
                    'supervisor' => self::name($a->supervisor) ?? 'Unassigned',
                    'required_hours' => $required,
                    'verified_hours' => $verified,
                    'remaining_hours' => max(0, round($required - $verified, 2)),
                    'percent' => $required > 0 ? min(100, round($verified / $required * 100, 1)) : 0,
                    'status' => self::label($a->status),
                    'term_status' => self::label($a->term_status) ?? 'In Progress',
                    'deficient_hours' => $a->deficient_hours !== null ? (float) $a->deficient_hours : null,
                ];
            });
    }

    public function stats(Collection $rows): array
    {
        $verified = round($rows->sum('verified_hours'), 2);
        $required = (float) $rows->sum('required_hours');

        return [
            ['label' => 'Recipients', 'value' => (string) $rows->count()],
            ['label' => 'Avg Completion', 'value' => ($required > 0 ? round($verified / $required * 100, 1) : 0) . '%'],
            ['label' => 'Verified Hours', 'value' => (string) $verified],
            ['label' => 'Offices', 'value' => (string) $rows->pluck('office')->filter()->unique()->count()],
        ];
    }
}
