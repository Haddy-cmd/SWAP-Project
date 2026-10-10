<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\Concern;
use App\Models\Interview;
use App\Models\NarrativeReport;
use App\Models\PromissoryNote;
use App\Models\SemesterPeriod;
use App\Models\StaffInvitation;
use App\Models\StipendHistory;
use App\Models\StudentProfile;
use App\Models\TermReport;
use App\Models\TimeLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Admin → Audit Logs: the trail filtered (area, who, which student, dates, sensitive only,
 * System Testing hidden by default, one record) and each entry presented as a readable sentence
 * with its before → after values. Nothing here writes to the log.
 */
class AuditLogService
{
    public const PER_PAGE = 25;

    private const TZ = 'Asia/Manila';

    /** Areas: label, the actions that belong there, and the models whose plain created/updated/deleted do. */
    public const AREAS = [
        'stipend' => ['Stipend', ['released', 'voided', 'claimed', 'stipend_signature_restored'], [StipendHistory::class]],
        'hours' => ['Hours & attendance', ['verified', 'rejected', 'clocked_in', 'clocked_out', 'manual_hours_added',
            'required_hours_requested', 'required_hours_approved', 'required_hours_rejected', 'verification_reminder_sent'], [TimeLog::class, NarrativeReport::class]],
        'applications' => ['Applications & renewals', ['renewal_hours_carried', 'rescheduled', 'promoted_to_recipient', 'returned_to_applicant'],
            [Application::class, Interview::class]],
        'terms' => ['Terms, reports & notes', ['term_closed', 'term_marked_deficient', 'term_requalified', 'term_report_submitted',
            'term_report_updated', 'term_report_reviewed', 'term_report_reminder', 'term_evaluated', 'reviewed', 'submitted'],
            [PromissoryNote::class, TermReport::class]],
        'placements' => ['Placements', ['qr_regenerated'], [Assignment::class]],
        'accounts' => ['Accounts & profile', ['profile_updated', 'password_changed', 'photo_updated', 'photo_removed',
            'signature_updated', 'signature_removed'], [User::class, StudentProfile::class, StaffInvitation::class]],
        'settings' => ['Semesters & settings', ['semester_period_created', 'semester_period_updated', 'semester_period_deleted', 'reordered'],
            [SemesterPeriod::class, \App\Models\Office::class, \App\Models\LandingPhoto::class]],
        'exports' => ['Report exports', ['report_exported'], []],
        'communication' => ['Concerns & announcements', ['announcement_sent', 'announcement_deleted', 'concern_submitted',
            'concern_updated', 'concern_message_added'], [Concern::class, \App\Models\Announcement::class]],
        'testing' => ['System Testing', [], []],
    ];

    /** Entries an admin should be able to find fast: money undone, roles, removals, exports, settings. */
    public const SENSITIVE_ACTIONS = ['voided', 'returned_to_applicant', 'promoted_to_recipient', 'password_changed', 'deleted',
        'report_exported', 'semester_period_deleted', 'testing_role_changed', 'required_hours_approved', 'qr_regenerated'];

    /** Short names for one record's history (`record=type:id`). */
    public const RECORD_TYPES = [
        'application' => Application::class, 'stipend' => StipendHistory::class, 'assignment' => Assignment::class,
        'user' => User::class, 'time_log' => TimeLog::class, 'promissory' => PromissoryNote::class,
        'term_report' => TermReport::class, 'interview' => Interview::class, 'concern' => Concern::class,
        'semester' => SemesterPeriod::class,
    ];

    /** Never shown in "what changed" (secrets and bookkeeping). */
    private const HIDDEN_KEYS = ['id', 'created_at', 'updated_at', 'deleted_at', 'qr_secret', 'password', 'remember_token',
        'claim_token', 'token', 'unlock_token', 'ubo_release_pin_hash', 'pin', 'migrated'];

    private const GENERIC = ['created', 'updated', 'deleted'];

    public function list(array $filters): array
    {
        $page = $this->query($filters)->with(['user:id,name,role', 'subject:id,name,role', 'subject.profile:id,user_id,student_id_number'])
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate(self::PER_PAGE);

        return [
            'data' => $this->present(collect($page->items())),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(), 'per_page' => self::PER_PAGE],
        ];
    }

    /** Areas and the people who appear in the log as the one acting (the "Who" filter). */
    public function options(): array
    {
        $actorIds = AuditLog::whereNotNull('user_id')->distinct()->pluck('user_id');

        return [
            'areas' => collect(self::AREAS)->map(fn ($a, $key) => ['key' => $key, 'label' => $a[0]])->values()->all(),
            'actors' => User::withTrashed()->whereIn('id', $actorIds)->orderBy('name')->get(['id', 'name', 'role'])
                ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'role' => $u->role])->all(),
            'record_types' => array_keys(self::RECORD_TYPES),
        ];
    }

    public function query(array $f): Builder
    {
        $q = AuditLog::query();

        if (!empty($f['area'])) {
            $this->whereArea($q, $f['area']);
        }
        if (!empty($f['actor_id'])) {
            $q->where('user_id', $f['actor_id']);
        }
        if (!empty($f['subject_user_id'])) {
            $q->where('subject_user_id', $f['subject_user_id']);
        }
        if (!empty($f['subject'])) {
            $term = '%' . mb_strtolower(trim($f['subject'])) . '%';
            $ids = User::withTrashed()
                ->where(fn ($w) => $w->whereRaw('LOWER(name) LIKE ?', [$term])->orWhereRaw('LOWER(email) LIKE ?', [$term])
                    ->orWhereHas('profile', fn ($p) => $p->where('student_id_number', 'like', $term)))
                ->pluck('id');
            $q->whereIn('subject_user_id', $ids);
        }
        if (!empty($f['record'])) {
            [$type, $id] = explode(':', $f['record']) + [null, null];
            $q->where('auditable_type', self::RECORD_TYPES[$type])->where('auditable_id', (int) $id);
        }
        if (!empty($f['from'])) {
            $q->where('created_at', '>=', Carbon::parse($f['from'], self::TZ)->startOfDay()->utc());
        }
        if (!empty($f['to'])) {
            $q->where('created_at', '<=', Carbon::parse($f['to'], self::TZ)->endOfDay()->utc());
        }
        if (!empty($f['sensitive'])) {
            $q->where(fn ($w) => $w->whereIn('action', self::SENSITIVE_ACTIONS)
                ->orWhere(fn ($u) => $u->where('action', 'updated')->where('auditable_type', User::class)));
        }
        // System Testing is noise in day-to-day review: hidden unless asked for (or that area is picked).
        $testingArea = ($f['area'] ?? null) === 'testing';
        if (empty($f['include_testing']) && !$testingArea && empty($f['record']) && empty($f['subject_user_id'])) {
            $q->where('action', 'not like', 'testing\_%')
                ->whereNotExists(fn ($s) => $s->selectRaw('1')->from('users')
                    ->whereColumn('users.id', 'audit_logs.subject_user_id')
                    ->whereNotNull('users.testing_added_at')
                    ->whereColumn('audit_logs.created_at', '>=', 'users.testing_added_at'));
        }

        return $q;
    }

    private function whereArea(Builder $q, string $area): void
    {
        if ($area === 'testing') {
            $q->where('action', 'like', 'testing\_%');

            return;
        }
        [, $actions, $types] = self::AREAS[$area];
        $claimed = collect(self::AREAS)->except($area)->flatMap(fn ($a) => $a[1])->all();
        $q->where(fn ($w) => $w->whereIn('action', $actions)
            ->orWhere(fn ($t) => $t->whereIn('auditable_type', $types ?: ['-'])->whereNotIn('action', $claimed)
                ->where('action', 'not like', 'testing\_%')));
    }

    /** Which area an entry belongs to (the badge). */
    public static function areaOf(AuditLog $log): string
    {
        if (str_starts_with($log->action, 'testing_')) {
            return 'testing';
        }
        foreach (self::AREAS as $key => [, $actions]) {
            if (in_array($log->action, $actions, true)) {
                return $key;
            }
        }
        foreach (self::AREAS as $key => [, , $types]) {
            if (in_array($log->auditable_type, $types, true)) {
                return $key;
            }
        }

        return 'other';
    }

    public static function isSensitive(AuditLog $log): bool
    {
        return in_array($log->action, self::SENSITIVE_ACTIONS, true)
            || ($log->action === 'updated' && $log->auditable_type === User::class);
    }

    // ── Presentation ────────────────────────────────────────────────────────

    /** @param  Collection<int, AuditLog>  $logs */
    public function present(Collection $logs): array
    {
        $records = $this->loadRecords($logs);

        return $logs->map(function (AuditLog $log) use ($records) {
            $record = $records[$log->auditable_type][$log->auditable_id] ?? null;
            $area = self::areaOf($log);

            return [
                'id' => $log->id,
                'action' => $log->action,
                'area' => $area,
                'area_label' => self::AREAS[$area][0] ?? 'Other',
                'sensitive' => self::isSensitive($log),
                'summary' => $this->summary($log, $record),
                'entity' => $this->entity($log, $record),
                'record' => ($type = array_search($log->auditable_type, self::RECORD_TYPES, true)) ? "{$type}:{$log->auditable_id}" : null,
                'actor' => $log->user ? ['id' => $log->user->id, 'name' => $log->user->name, 'role' => $log->user->role] : null,
                'subject' => $log->subject ? [
                    'id' => $log->subject->id, 'name' => $log->subject->name,
                    'student_id' => $log->subject->profile?->student_id_number,
                ] : null,
                'changes' => $this->changes($log),
                'ip_address' => $log->ip_address,
                'user_agent' => $log->user_agent,
                'created_at' => $log->created_at?->toISOString(),
            ];
        })->values()->all();
    }

    /** The audited rows, loaded once per model type (soft-deleted ones too). */
    private function loadRecords(Collection $logs): array
    {
        $out = [];
        foreach ($logs->groupBy('auditable_type') as $type => $group) {
            if (!class_exists($type)) {
                continue;
            }
            $query = $type::query();
            if (in_array(\Illuminate\Database\Eloquent\SoftDeletes::class, class_uses_recursive($type), true)) {
                $query->withTrashed();
            }
            if ($type === Assignment::class) {
                $query->with('office:id,name');
            }
            $out[$type] = $query->whereIn((new $type)->getKeyName(), $group->pluck('auditable_id')->unique())->get()->keyBy(fn ($m) => $m->getKey())->all();
        }

        return $out;
    }

    private function entity(AuditLog $log, $record): string
    {
        $id = $log->auditable_id;

        return match ($log->auditable_type) {
            StipendHistory::class => 'Stipend ' . ($record?->control_number ?? $log->new_values['control_number'] ?? "#{$id}"),
            Application::class => "Application #{$id}" . ($record ? ' · ' . ($record->type === 'renewal' ? 'renewal' : 'new') . " · {$record->semester} {$record->academic_year}" : ''),
            TimeLog::class => 'Time log' . ($record?->date ? ' of ' . Carbon::parse($record->date)->format('M j, Y') : " #{$id}"),
            Assignment::class => 'Placement' . ($record ? " · {$record->semester} {$record->academic_year}" . ($record->office ? " · {$record->office->name}" : '') : " #{$id}"),
            User::class => 'Account' . ($record ? " {$record->name}" : " #{$id}"),
            PromissoryNote::class => "Promissory note #{$id}",
            TermReport::class => "End-of-term report #{$id}",
            Interview::class => 'Interview' . ($record ? " for application #{$record->application_id}" : " #{$id}"),
            SemesterPeriod::class => 'Semester ' . ($record ? "{$record->semester} {$record->academic_year}" : "#{$id}"),
            Concern::class => "Concern #{$id}",
            default => Str::headline(class_basename($log->auditable_type)) . " #{$id}",
        };
    }

    /** One readable sentence (without the actor, who is shown beside it). */
    private function summary(AuditLog $log, $record): string
    {
        $new = $log->new_values ?? [];
        $old = $log->old_values ?? [];
        $who = $log->subject?->name ?? 'the student';
        $entity = Str::lcfirst($this->entity($log, $record)); // mid-sentence: "Released stipend SWAP-…"
        $hours = $record instanceof TimeLog ? rtrim(rtrim(number_format((float) $record->duration_hours, 2), '0'), '.') . ' h' : null;
        $money = fn ($v) => '₱' . number_format((float) $v, 2);

        return match ($log->action) {
            'verified' => 'Verified ' . ($hours ? "{$hours} of {$who}" : "{$who}'s time log"),
            'rejected' => 'Rejected ' . ($hours ? "{$hours} of {$who}" : "{$who}'s time log"),
            'clocked_in' => "{$who} clocked in",
            'clocked_out' => "{$who} clocked out" . ($hours ? " ({$hours})" : ''),
            'manual_hours_added' => 'Added ' . ($hours ?? 'bonus hours') . " for {$who}",
            'released' => "Released {$entity}" . (isset($new['amount']) ? ' (' . $money($new['amount']) . ')' : '') . " to {$who}"
                . (!empty($new['migrated']) ? ' — automatically, when the claim step was retired' : ''),
            'voided' => "Voided {$entity}" . (!empty($new['void_reason']) ? " — {$new['void_reason']}" : ''),
            'claimed' => "Recorded the Banking Office payout of {$entity}",
            'stipend_signature_restored' => "Put {$who}'s signature back on {$entity}",
            'promoted_to_recipient' => "Made {$who} a recipient (application approved)" . (!empty($new['migrated']) ? ' — automatically, by the approval rule' : ''),
            'returned_to_applicant' => "Returned {$who} to the applicant portal (renewal rejected)",
            'report_exported' => 'Exported the ' . Str::headline((string) ($new['type'] ?? 'report')) . ' report (' . strtoupper((string) ($new['format'] ?? '')) . (isset($new['rows']) ? ", {$new['rows']} rows" : '') . ')',
            'password_changed' => "Changed {$who}'s password",
            'profile_updated' => "Updated {$who}'s profile",
            'photo_updated', 'photo_removed' => ($log->action === 'photo_updated' ? 'Changed' : 'Removed') . " {$who}'s photo",
            'signature_updated', 'signature_removed' => ($log->action === 'signature_updated' ? 'Saved' : 'Removed') . " {$who}'s signature",
            'reviewed' => ($new['status'] ?? null) ? 'Marked ' . $entity . ' ' . Str::lower((string) $new['status']) : "Reviewed {$entity}",
            'submitted' => "{$who} submitted {$entity}",
            'term_report_submitted', 'term_report_updated' => "{$who} " . ($log->action === 'term_report_submitted' ? 'submitted' : 'edited') . ' the end-of-term report',
            'term_report_reviewed' => "Accepted {$who}'s end-of-term report" . (isset($new['renewal_eligible']) ? ($new['renewal_eligible'] ? ' (eligible for renewal)' : ' (not eligible for renewal)') : ''),
            'term_closed', 'term_requalified', 'term_marked_deficient' => "Recorded {$who}'s term as " . Str::headline((string) ($new['term_status'] ?? 'closed')),
            'required_hours_requested' => "Asked to change {$who}'s required hours",
            'verification_reminder_sent' => "Reminded {$who} to verify " . ($new['pending'] ?? 'their') . ' waiting hour logs' . (isset($new['term']) ? " ({$new['term']})" : ''),
            'required_hours_approved', 'required_hours_rejected' => ($log->action === 'required_hours_approved' ? 'Approved' : 'Rejected') . " the required-hours change for {$who}",
            'qr_regenerated' => "Regenerated the QR code of {$entity}",
            'semester_period_created', 'semester_period_updated', 'semester_period_deleted' => Str::ucfirst(Str::after($log->action, 'semester_period_')) . " {$entity}",
            'announcement_sent' => 'Sent an announcement' . (isset($new['title']) ? " — \"{$new['title']}\"" : ''),
            'announcement_deleted' => 'Deleted an announcement',
            'concern_submitted' => "{$who} sent a concern",
            'concern_message_added' => "Replied in {$entity}",
            'concern_updated' => "Updated {$entity}",
            'updated' => $this->updatedSentence($log, $entity, $who, $old, $new),
            'created' => $log->auditable_type === Application::class ? "{$who} submitted {$entity}" : "Created {$entity}",
            'deleted' => "Deleted {$entity}",
            default => str_starts_with($log->action, 'testing_')
                ? 'System Testing: ' . Str::lower(Str::headline(Str::after($log->action, 'testing_'))) . ($log->subject ? " — {$who}" : '')
                : Str::headline($log->action) . " — {$entity}",
        };
    }

    private function updatedSentence(AuditLog $log, string $entity, string $who, array $old, array $new): string
    {
        if ($log->auditable_type === User::class) {
            if (array_key_exists('is_active', $new) && ($old['is_active'] ?? null) !== $new['is_active']) {
                return ($new['is_active'] ? 'Reactivated ' : 'Deactivated ') . $who;
            }
            if (array_key_exists('role', $new) && ($old['role'] ?? null) !== $new['role']) {
                return "Changed {$who}'s role from " . ($old['role'] ?? '—') . " to {$new['role']}";
            }
        }
        if ($log->auditable_type === Application::class && isset($new['status'])) {
            return match ($new['status']) {
                'approved' => "Approved {$entity}",
                'rejected' => "Rejected {$entity}",
                default => "Moved {$entity} to " . Str::lower(Str::headline($new['status'])),
            };
        }
        if ($log->auditable_type === Interview::class && ($new['status'] ?? null) === 'no_show') {
            return "Marked {$entity} as a no-show";
        }

        return "Updated {$entity}";
    }

    /**
     * Field-by-field before → after, readable: secrets and bookkeeping left out, only what
     * changed (everything set, for a creation).
     *
     * @return list<array{field: string, before: ?string, after: ?string}>
     */
    private function changes(AuditLog $log): array
    {
        $old = $log->old_values ?? [];
        $new = $log->new_values ?? [];
        $out = [];
        foreach (array_unique(array_merge(array_keys($old), array_keys($new))) as $key) {
            if (in_array($key, self::HIDDEN_KEYS, true) || str_ends_with($key, '_token') || str_ends_with($key, '_hash')) {
                continue;
            }
            $before = $this->format($key, $old[$key] ?? null);
            $after = $this->format($key, $new[$key] ?? null);
            if ($before === $after) {
                continue;
            }
            $out[] = ['field' => Str::ucfirst(Str::lower(Str::headline($key))), 'before' => $before, 'after' => $after];
            if (count($out) >= 20) {
                break;
            }
        }

        return $out;
    }

    private function format(string $key, mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }
        if (is_array($value)) {
            return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        if (in_array($key, ['amount'], true) && is_numeric($value)) {
            return '₱' . number_format((float) $value, 2);
        }
        if (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/', $value)) {
            return Carbon::parse($value)->timezone(self::TZ)->format('M j, Y g:i A');
        }

        return (string) $value;
    }
}
