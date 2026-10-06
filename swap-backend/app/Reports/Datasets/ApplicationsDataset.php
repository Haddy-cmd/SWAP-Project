<?php

namespace App\Reports\Datasets;

use App\Models\Application;
use App\Reports\ReportDataset;
use Illuminate\Support\Collection;

/** Every application of the term (new and renewal) with the applicant's college. */
class ApplicationsDataset extends ReportDataset
{
    private const PENDING = ['Submitted', 'Under Review', 'Interview Scheduled'];

    public function title(): string
    {
        return 'Applications Summary';
    }

    public function slug(): string
    {
        return 'applications-summary';
    }

    public function defaultGroup(): ?string
    {
        return 'college';
    }

    public function columns(): array
    {
        return [
            self::col('applicant', 'Applicant'),
            self::col('email', 'Email'),
            self::col('student_id', 'Student ID'),
            self::col('college', 'College', filterable: true),
            self::col('program', 'Program', filterable: true),
            self::col('year_level', 'Year Level', filterable: true),
            self::col('type', 'Type', filterable: true),
            self::col('status', 'Status', 'status', filterable: true),
            self::col('submitted', 'Submitted', 'date'),
        ];
    }

    public function rows(): Collection
    {
        return Application::whereHas('user')
            ->where('academic_year', $this->scope->academicYear)->where('semester', $this->scope->semester)
            ->with('user.profile')->orderBy('created_at')->get()
            ->map(fn (Application $a) => [
                'applicant' => self::name($a->user),
                'email' => $a->user?->email,
                'student_id' => $a->user?->profile?->student_id_number,
                'college' => $a->user?->profile?->college,
                'program' => $a->user?->profile?->program,
                'year_level' => $a->user?->profile?->year_level ? 'Year ' . $a->user->profile->year_level : null,
                'type' => self::label($a->type ?? 'new'),
                'status' => self::label($a->status),
                'submitted' => $a->created_at?->timezone('Asia/Manila')->format('Y-m-d H:i'),
            ]);
    }

    public function stats(Collection $rows): array
    {
        return [
            ['label' => 'Total', 'value' => (string) $rows->count()],
            ['label' => 'Approved', 'value' => (string) $rows->where('status', 'Approved')->count()],
            ['label' => 'Pending', 'value' => (string) $rows->whereIn('status', self::PENDING)->count()],
            ['label' => 'Rejected', 'value' => (string) $rows->where('status', 'Rejected')->count()],
        ];
    }
}
