<?php

namespace App\Services;

use App\Models\Application;
use App\Models\ApplicationDocument;
use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\Interview;
use App\Models\PromissoryNote;
use App\Models\StipendHistory;
use App\Models\TermEvaluation;
use App\Models\TermReport;
use App\Models\TestingChange;
use App\Models\TimeLog;
use App\Models\User;
use App\Support\TestTools;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * Admin → System Testing on existing accounts: the admin picks real recipients or
 * applicants, and shortcuts move their data into the state a test needs (end a term now,
 * add verified hours, overdue makeup…), so time-gated flows can be walked without
 * waiting. The real rules then run on that data. Every shortcut journals what it did, so
 * "Remove from testing" can undo it.
 */
class TestingService
{
    public const MSG_NOT_TEST = 'Recipient not found in System Testing.';
    public const MSG_NO_NOTE = 'This recipient has no approved promissory note yet.';
    public const MSG_NOT_STUDENT = 'Only recipients and applicants can be added to System Testing.';
    public const MSG_ALREADY = 'This account is already in System Testing.';
    public const MSG_INACTIVE = 'Deactivated accounts can\'t be added to System Testing.';
    public const MSG_NOT_PICKED = 'This account is not in System Testing.';
    public const MSG_HOURS_DONE = 'This recipient\'s hours are already complete.';
    public const MSG_CLOCKED_IN = 'This recipient is already clocked in.';
    public const MSG_NOT_CLOCKED_IN = 'This recipient isn\'t clocked in.';
    public const MSG_NO_HOURS = 'This recipient has no hours to reset.';

    /** Rows deleted with a time log (cascade), copied too so undo can put them back. */
    private const TIME_LOG_CHILDREN = ['narrative_reports', 'verifications'];

    private const PICKABLE_ROLES = ['recipient', 'applicant'];

    private const TZ = 'Asia/Manila';

    /** Hours per day "Complete hours" logs. */
    private const DAY_HOURS = 8;

    /** The `attendance:close-stale` default: a shift open this long is force-closed. */
    private const STALE_HOURS = 12;

    /** Never journaled: bookkeeping, and generated columns the database computes itself. */
    private const NOT_RESTORED = ['updated_at', 'duration_hours'];

    public function __construct(
        private readonly TermStatusService $termStatus,
        private readonly PromissoryService $promissory,
        private readonly AttendanceService $attendance,
    ) {}

    // ── Switch ──────────────────────────────────────────────────────────────

    public function setEnabled(User $admin, bool $on): void
    {
        $was = TestTools::enabled();
        TestTools::setEnabled($on);

        if ($was !== $on) {
            AuditLog::record($on ? 'testing_switched_on' : 'testing_switched_off', $admin, ['enabled' => $was], ['enabled' => $on], $admin->id);
        }
    }

    // ── Overview ────────────────────────────────────────────────────────────

    public function status(): array
    {
        $users = User::with('profile')->whereNotNull('testing_added_at')->orderBy('role')->orderBy('testing_added_at')->get();
        $changes = TestingChange::whereIn('user_id', $users->pluck('id'))
            ->selectRaw('user_id, count(*) as n')->groupBy('user_id')->pluck('n', 'user_id');

        $assignments = Assignment::with(['evaluation', 'termReport'])
            ->withPromissoryFlags()
            ->whereIn('user_id', $users->pluck('id'))
            ->orderByDesc('id')
            ->get()
            ->groupBy('user_id');
        $applications = Application::whereIn('user_id', $users->pluck('id'))->orderByDesc('id')->get()->groupBy('user_id');
        $openShifts = TimeLog::whereIn('user_id', $users->pluck('id'))->where('status', 'open')->get(['user_id', 'time_in'])->keyBy('user_id');

        return [
            'enabled' => TestTools::enabled(),
            'accounts' => $users->map(fn (User $u) => [
                'id' => $u->id,
                'role' => $u->role,
                'name' => $u->name,
                'email' => $u->email,
                'student_id_number' => $u->profile?->student_id_number,
                // Shortcut changes recorded (undone on "Remove from testing").
                'changes' => (int) ($changes[$u->id] ?? 0),
                'clocked_in_since' => $openShifts->get($u->id)?->time_in?->toISOString(),
                'assignments' => ($assignments[$u->id] ?? collect())->map(fn (Assignment $a) => [
                    'id' => $a->id,
                    'term' => "{$a->semester} {$a->academic_year}",
                    'status' => $a->status,
                    'required_hours' => $a->required_hours,
                    'verified_hours' => round($a->verified_hours, 2),
                    'end_date' => $a->effectiveEndDate()?->toDateString(),
                    'term_badge' => $a->termBadge(),
                    'evaluation' => $a->evaluation?->rating,
                    'report_submitted' => $a->termReport?->submitted_at !== null,
                    'promissory' => $a->has_approved_promissory ? 'approved' : ($a->has_pending_promissory ? 'pending' : null),
                ])->values()->all(),
                'applications' => ($applications[$u->id] ?? collect())->map(fn (Application $a) => [
                    'id' => $a->id,
                    'term' => "{$a->semester} {$a->academic_year}",
                    'type' => $a->type ?? 'new',
                    'status' => $a->status,
                ])->values()->all(),
            ])->values()->all(),
        ];
    }

    // ── Shortcuts on a recipient's current term ─────────────────────────────

    public function addHours(User $recipient, float $hours, ?string $date, string $status, User $admin): TimeLog
    {
        $assignment = $this->currentAssignment($recipient);
        $day = $date ? Carbon::parse($date, self::TZ) : Carbon::now(self::TZ);
        $in = $day->copy()->setTime(8, 0)->utc();

        // The assignment is watched too: verified hours can lift a Deficient result.
        $log = $this->tracked($recipient, $admin, [$assignment], function () use ($assignment, $recipient, $day, $in, $hours, $status) {
            $log = TimeLog::create([
                'assignment_id' => $assignment->id,
                'user_id' => $recipient->id,
                'date' => $day->toDateString(),
                'time_in' => $in,
                'time_out' => $in->copy()->addMinutes((int) round($hours * 60)),
                'status' => $status,
                'verified_by' => $status === 'verified' ? $assignment->supervisor_id : null,
                'verified_at' => $status === 'verified' ? now() : null,
            ]);
            if ($status === 'verified') {
                $this->termStatus->refreshById($assignment->id);
            }

            return $log;
        });
        $this->audit('testing_hours_added', $assignment, ['hours' => $hours, 'date' => $day->toDateString(), 'status' => $status], $admin);

        return $log->refresh();
    }

    /** The term's last day becomes yesterday, so "after the semester" rules apply now. */
    public function endTerm(User $recipient, User $admin): Assignment
    {
        $assignment = $this->currentAssignment($recipient);
        $yesterday = Carbon::now(self::TZ)->subDay()->startOfDay();
        $changes = ['end_date' => $yesterday->toDateString()];
        if ($assignment->start_date === null || $assignment->start_date->gte($yesterday)) {
            $changes['start_date'] = $yesterday->copy()->subMonths(4)->toDateString();
        }
        $this->tracked($recipient, $admin, [$assignment], fn () => $assignment->update($changes));
        $this->audit('testing_term_ended', $assignment, $changes, $admin);

        return $assignment->fresh();
    }

    /** Record the Qualified/Deficient verdict now, for this term only. */
    public function closeTerm(User $recipient, User $admin): Assignment
    {
        $assignment = $this->currentAssignment($recipient);
        $this->tracked($recipient, $admin, [$assignment], fn () => $this->termStatus->close($assignment));
        $this->audit('testing_term_closed', $assignment, ['term_status' => $assignment->fresh()->term_status], $admin);

        return $assignment->fresh();
    }

    public function makeupOverdue(User $recipient, User $admin): PromissoryNote
    {
        $assignment = $this->currentAssignment($recipient);
        $note = PromissoryNote::where('assignment_id', $assignment->id)
            ->where('status', PromissoryNote::STATUS_APPROVED)->latest('id')->first();
        if (!$note) {
            throw new UnprocessableEntityHttpException(self::MSG_NO_NOTE);
        }
        $this->tracked($recipient, $admin, [$note], fn () => $note->update(['makeup_deadline' => Carbon::now(self::TZ)->subDay()->toDateString()]));
        $this->audit('testing_makeup_overdue', $assignment, ['promissory_note_id' => $note->id], $admin);

        return $note->fresh();
    }

    public function submitTermReport(User $recipient, User $admin): TermReport
    {
        $assignment = $this->currentAssignment($recipient);
        $report = $this->tracked($recipient, $admin, [TermReport::where('assignment_id', $assignment->id)->first()],
            fn () => TermReport::updateOrCreate(['assignment_id' => $assignment->id], [
                'user_id' => $recipient->id,
                'content' => str_repeat('Test end-of-term report: assisted the office with filing, records and student queries. ', 2),
                'submitted_at' => now(),
            ]));
        $this->audit('testing_term_report', $assignment, null, $admin);

        return $report;
    }

    public function evaluate(User $recipient, int $rating, User $admin): TermEvaluation
    {
        $assignment = $this->currentAssignment($recipient);
        $evaluation = $this->tracked($recipient, $admin, [TermEvaluation::where('assignment_id', $assignment->id)->first()],
            fn () => TermEvaluation::updateOrCreate(['assignment_id' => $assignment->id], [
                'evaluator_id' => $assignment->supervisor_id,
                'rating' => $rating,
                'remarks' => "Test evaluation ({$rating}/5).",
                'passed' => $rating >= TermEvaluation::PASSING_RATING,
            ]));
        $this->audit('testing_evaluated', $assignment, ['rating' => $rating], $admin);

        return $evaluation;
    }

    /** A renewal for the next term with a sample COR, even while renewal is closed. */
    public function submitRenewal(User $recipient, User $admin): Application
    {
        $assignment = $this->currentAssignment($recipient);
        [$year, $semester] = $this->nextTerm($assignment);

        if (Application::where('user_id', $recipient->id)->where('academic_year', $year)->where('semester', $semester)->exists()) {
            throw new UnprocessableEntityHttpException("This recipient already has a submission for {$semester} {$year}.");
        }

        $application = $this->tracked($recipient, $admin, [], function () use ($recipient, $year, $semester) {
            $application = Application::create([
                'user_id' => $recipient->id, 'academic_year' => $year, 'semester' => $semester,
                'status' => 'submitted', 'type' => 'renewal',
            ]);
            $this->attachSampleDocument($application, 'cor');

            return $application;
        });
        $this->audit('testing_renewal_submitted', $assignment, ['application_id' => $application->id, 'term' => "{$semester} {$year}"], $admin);

        return $application;
    }

    /** Back to "in progress": clears the verdict and the term-end shortcut. */
    public function resetTerm(User $recipient, User $admin): Assignment
    {
        $assignment = $this->currentAssignment($recipient);
        $hasPeriod = $assignment->semesterPeriod() !== null;
        $this->tracked($recipient, $admin, [$assignment], fn () => $assignment->update([
            'term_status' => null, 'deficient_hours' => null, 'term_status_at' => null,
            'term_status_by' => null, 'term_status_reason' => null,
            'end_date' => $hasPeriod ? null : Carbon::now(self::TZ)->addMonths(4)->toDateString(),
        ]));
        $this->audit('testing_term_reset', $assignment, null, $admin);

        return $assignment->fresh();
    }

    /**
     * Log exactly the hours still missing, verified: up to 8 h a day at 08:00 on past days
     * (yesterday backwards, no Sundays).
     *
     * @return array{hours: float, days: int}
     */
    public function completeHours(User $recipient, User $admin): array
    {
        $assignment = $this->currentAssignment($recipient);
        $missing = round((float) $assignment->required_hours - (float) $assignment->verified_hours, 2);
        if ($missing <= 0) {
            throw new UnprocessableEntityHttpException(self::MSG_HOURS_DONE);
        }

        $logs = $this->tracked($recipient, $admin, [$assignment], function () use ($assignment, $recipient, $missing) {
            $logs = [];
            $left = $missing;
            $day = Carbon::now(self::TZ)->subDay()->startOfDay();
            while ($left > 0) {
                if ($day->isSunday()) {
                    $day->subDay();
                    continue;
                }
                $hours = min(self::DAY_HOURS, $left);
                $in = $day->copy()->setTime(8, 0)->utc();
                $logs[] = TimeLog::create([
                    'assignment_id' => $assignment->id,
                    'user_id' => $recipient->id,
                    'date' => $day->toDateString(),
                    'time_in' => $in,
                    // Rounded up to the minute so the total never falls a hundredth short.
                    'time_out' => $in->copy()->addMinutes((int) ceil($hours * 60)),
                    'status' => 'verified',
                    'verified_by' => $assignment->supervisor_id,
                    'verified_at' => now(),
                ]);
                $left = round($left - $hours, 2);
                $day->subDay();
            }
            $this->termStatus->refreshById($assignment->id);

            return $logs;
        });
        $this->audit('testing_hours_completed', $assignment, ['hours' => $missing, 'days' => count($logs)], $admin);

        return ['hours' => $missing, 'days' => count($logs)];
    }

    /**
     * Back to 0 hours for the current term: every time log of it is copied into the journal
     * (with its narrative report and verifications) and removed, so the term can be tested
     * from scratch. Undo on "Remove from testing" puts them all back with their own IDs.
     *
     * @return array{logs: int, hours: float}
     */
    public function resetHours(User $recipient, User $admin): array
    {
        $assignment = $this->currentAssignment($recipient);
        $ids = TimeLog::where('assignment_id', $assignment->id)->orderBy('id')->pluck('id');
        if ($ids->isEmpty()) {
            throw new UnprocessableEntityHttpException(self::MSG_NO_HOURS);
        }
        $hours = round((float) $assignment->verified_hours, 2);

        DB::transaction(function () use ($recipient, $admin, $ids) {
            foreach ($ids as $id) {
                $row = (array) DB::table('time_logs')->where('id', $id)->first();
                unset($row['duration_hours']); // generated by the database
                $children = [];
                foreach (self::TIME_LOG_CHILDREN as $table) {
                    $children[$table] = DB::table($table)->where('time_log_id', $id)->get()->map(fn ($r) => (array) $r)->all();
                }
                TestingChange::create([
                    'user_id' => $recipient->id,
                    'subject_type' => TimeLog::class,
                    'subject_id' => $id,
                    'action' => TestingChange::DELETED,
                    'old_values' => ['table' => 'time_logs', 'row' => $row, 'children' => array_filter($children)],
                    'created_by' => $admin->id,
                ]);
            }
            // A plain delete (no model events): selfie files stay for the restore; the
            // narrative reports and verifications go with the logs (cascade), copied above.
            TimeLog::whereIn('id', $ids)->toBase()->delete();
        });
        $this->audit('testing_hours_reset', $assignment, ['logs' => $ids->count(), 'verified_hours' => $hours], $admin);

        return ['logs' => $ids->count(), 'hours' => $hours];
    }

    /** File a promissory note for the student, with a sample PDF — through the real rules. */
    public function fileNote(User $recipient, User $admin): PromissoryNote
    {
        $assignment = $this->currentAssignment($recipient);
        $tmp = tempnam(sys_get_temp_dir(), 'swap-note');
        file_put_contents($tmp, self::samplePdf('SWAP System Testing: sample promissory note'));

        try {
            $file = new UploadedFile($tmp, 'promissory-note.pdf', 'application/pdf', null, true);
            $note = $this->tracked($recipient, $admin, [], fn () => $this->promissory->submit(
                $recipient, ['assignment_id' => $assignment->id], $file,
            ));
        } finally {
            @unlink($tmp);
        }
        $this->audit('testing_promissory_filed', $assignment, ['promissory_note_id' => $note->id], $admin);

        return $note;
    }

    /** Open a shift now without the QR scan; the student clocks out with their office QR as usual. */
    public function clockInNow(User $recipient, User $admin): TimeLog
    {
        $assignment = $this->currentAssignment($recipient);
        if (TimeLog::where('user_id', $recipient->id)->where('status', 'open')->exists()) {
            throw new UnprocessableEntityHttpException(self::MSG_CLOCKED_IN);
        }
        if ($assignment->required_hours > 0 && $assignment->verified_hours >= $assignment->required_hours) {
            throw new UnprocessableEntityHttpException(self::MSG_HOURS_DONE);
        }

        // Same fields as AttendanceService::createOpenLog, without a location.
        $log = $this->tracked($recipient, $admin, [], fn () => TimeLog::create([
            'assignment_id' => $assignment->id,
            'user_id' => $recipient->id,
            'date' => Carbon::today()->toDateString(),
            'time_in' => now(),
            'status' => 'open',
        ]));
        $this->audit('testing_clocked_in', $assignment, ['time_log_id' => $log->id], $admin);

        return $log;
    }

    /** Run the hourly safety net (attendance:close-stale) on the student's open shift now. */
    public function autoClockOut(User $recipient, User $admin): TimeLog
    {
        $log = TimeLog::where('user_id', $recipient->id)->where('status', 'open')->latest('id')->first();
        if (!$log) {
            throw new UnprocessableEntityHttpException(self::MSG_NOT_CLOCKED_IN);
        }

        $this->tracked($recipient, $admin, [$log], fn () => $this->attendance->closeStaleLog($log, self::STALE_HOURS));
        $this->audit('testing_auto_clocked_out', $log->assignment, ['time_log_id' => $log->id], $admin);

        return $log->fresh();
    }

    // ── Existing accounts: pick, journal, undo ──────────────────────────────

    /** Active recipients/applicants the admin can pick (not already picked). */
    public function candidates(string $search): array
    {
        $term = '%' . trim($search) . '%';
        $users = User::with('profile')
            ->whereIn('role', self::PICKABLE_ROLES)
            ->whereNull('testing_added_at')
            ->where('is_active', true)
            ->where(fn ($q) => $q->where('name', 'ilike', $term)
                ->orWhere('email', 'ilike', $term)
                ->orWhereHas('profile', fn ($p) => $p->where('student_id_number', 'ilike', $term)))
            ->orderBy('name')
            ->limit(10)
            ->get();
        $terms = Assignment::whereIn('user_id', $users->pluck('id'))->where('status', 'active')
            ->orderByDesc('id')->get()->unique('user_id')->keyBy('user_id');

        return $users->map(fn (User $u) => [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'role' => $u->role,
            'student_id_number' => $u->profile?->student_id_number,
            'term' => isset($terms[$u->id]) ? "{$terms[$u->id]->semester} {$terms[$u->id]->academic_year}" : null,
        ])->values()->all();
    }

    public function addExisting(User $admin, int $id): User
    {
        $user = User::find($id);
        if (!$user) {
            throw new NotFoundHttpException('Account not found.');
        }
        if ($user->testing_added_at !== null) {
            throw new UnprocessableEntityHttpException(self::MSG_ALREADY);
        }
        if (!in_array($user->role, self::PICKABLE_ROLES, true)) {
            throw new UnprocessableEntityHttpException(self::MSG_NOT_STUDENT);
        }
        if (!$user->is_active) {
            throw new UnprocessableEntityHttpException(self::MSG_INACTIVE);
        }

        $user->forceFill(['testing_added_at' => now()])->save();
        AuditLog::record('testing_account_added', $user, null, ['email' => $user->email], $admin->id);

        return $user;
    }

    /**
     * Take a picked account out of testing, first undoing what the shortcuts did to it
     * (or keeping it). Works while the tools are off too.
     *
     * @return array{undone: int, kept: list<string>}
     */
    public function removeExisting(User $admin, int $id, bool $undo): array
    {
        $user = User::whereNotNull('testing_added_at')->find($id);
        if (!$user) {
            throw new NotFoundHttpException(self::MSG_NOT_PICKED);
        }

        $result = DB::transaction(function () use ($user, $undo) {
            $result = $undo ? $this->undo($user) : ['undone' => 0, 'kept' => []];
            TestingChange::where('user_id', $user->id)->delete();
            $user->forceFill(['testing_added_at' => null])->save();

            return $result;
        });
        AuditLog::record('testing_account_removed', $user, null, ['undo' => $undo] + $result, $admin->id);

        return $result;
    }

    /** Take every picked account out of testing, undoing what the shortcuts changed. */
    public function releaseAll(User $admin): int
    {
        $ids = User::whereNotNull('testing_added_at')->pluck('id');
        foreach ($ids as $id) {
            $this->removeExisting($admin, $id, true);
        }
        AuditLog::record('testing_released_all', $admin, null, ['accounts' => $ids->count()], $admin->id);

        return $ids->count();
    }

    /**
     * Replay a picked account's journal newest first: delete what the shortcuts created,
     * put back the raw values they changed. A renewal that was decided in the meantime is
     * kept (approving it may have placed the student for next term).
     *
     * @return array{undone: int, kept: list<string>}
     */
    private function undo(User $user): array
    {
        $undone = 0;
        $kept = [];

        foreach (TestingChange::where('user_id', $user->id)->orderByDesc('id')->get() as $change) {
            if ($change->action === TestingChange::DELETED) {
                try {
                    DB::transaction(fn () => $this->restoreDeleted($change->old_values ?? []));
                    $undone++;
                } catch (\Illuminate\Database\QueryException) {
                    $kept[] = "A reset time log (#{$change->subject_id}) couldn't be put back because something took its place in the meantime.";
                }
                continue;
            }

            $class = $change->subject_type;
            $model = class_exists($class) ? $class::query()->find($change->subject_id) : null;
            if (!$model) {
                continue;
            }

            if ($change->action === TestingChange::CREATED && ($reason = $this->keepReason($model))) {
                $kept[] = $reason;
                continue;
            }

            try {
                // A savepoint per change: one that can't go back doesn't undo the rest.
                DB::transaction(fn () => $change->action === TestingChange::CREATED
                    ? $this->deleteCreated($model)
                    // Raw DB values, so dates and JSON go back exactly as they were.
                    : $model->setRawAttributes(array_merge($model->getAttributes(), $change->old_values ?? []))->save());
                $undone++;
            } catch (\Illuminate\Database\QueryException) {
                $kept[] = 'One change to ' . class_basename($model) . " #{$model->getKey()} couldn't be undone because it changed in the meantime.";
            }
        }

        return ['undone' => $undone, 'kept' => $kept];
    }

    /** Why a record a shortcut created must stay (something real now depends on it), or null. */
    private function keepReason(Model $model): ?string
    {
        if ($model instanceof Application && in_array($model->status, ['approved', 'rejected'], true)) {
            return "Renewal for {$model->semester} {$model->academic_year} was already {$model->status}, so it was kept.";
        }
        if ($model instanceof PromissoryNote) {
            $term = "{$model->semester} {$model->academic_year}";
            $stub = StipendHistory::where('user_id', $model->user_id)->where('academic_year', $model->academic_year)
                ->where('semester', $model->semester)->whereIn('status', ['pending', 'certified', 'claimed', 'released'])->exists();
            if ($stub) {
                return "The promissory note for {$term} was kept: a stipend stub was already prepared from it.";
            }
            if (Assignment::whereKey($model->assignment_id)->where('status', '!=', 'active')->exists()) {
                return "The promissory note for {$term} was kept: a renewal was already approved with it.";
            }
        }

        return null;
    }

    /** Put a deleted record back exactly as it was (same ID), then the rows that hung off it. */
    private function restoreDeleted(array $copy): void
    {
        if (DB::table($copy['table'])->where('id', $copy['row']['id'])->exists()) {
            return;
        }
        DB::table($copy['table'])->insert($copy['row']);
        foreach ($copy['children'] ?? [] as $table => $rows) {
            foreach ($rows as $row) {
                DB::table($table)->insert($row);
            }
        }
    }

    private function deleteCreated(Model $model): void
    {
        $disk = Storage::disk(config('filesystems.documents_disk', 'public'));

        if ($model instanceof Application) {
            $disk->deleteDirectory("documents/{$model->id}");
            ApplicationDocument::where('application_id', $model->id)->delete();
            Interview::where('application_id', $model->id)->delete();
        }
        if ($model instanceof PromissoryNote) {
            if ($model->file_path) {
                $disk->delete($model->file_path);
            }
            // The supervisors' bell entries about it would lead nowhere.
            DB::table('notifications')->where(fn ($q) => $q
                ->whereRaw('CAST(data AS TEXT) LIKE ?', ['%"promissory_id":' . $model->id . ',%'])
                ->orWhereRaw('CAST(data AS TEXT) LIKE ?', ['%"promissory_id":' . $model->id . '}%']))->delete();
        }

        $model->delete();
    }

    /**
     * Run a shortcut and record what it did to the picked account: the record(s) it
     * returns that it created, and the old raw values of each watched record it changed.
     *
     * @param  array<int, Model|null>  $watch
     */
    private function tracked(User $account, User $admin, array $watch, callable $run): mixed
    {
        return DB::transaction(function () use ($account, $admin, $watch, $run) {
            $watch = array_values(array_filter($watch));
            $before = array_map(fn (Model $m) => $m->getAttributes(), $watch);

            $result = $run();

            foreach ($watch as $i => $model) {
                $now = $model->newQueryWithoutScopes()->find($model->getKey())?->getAttributes() ?? [];
                $old = [];
                foreach ($before[$i] as $key => $value) {
                    if (!in_array($key, self::NOT_RESTORED, true) && self::raw($value) !== self::raw($now[$key] ?? null)) {
                        $old[$key] = $value;
                    }
                }
                if ($old) {
                    $this->journal($account, $model, TestingChange::UPDATED, $old, $admin);
                }
            }
            foreach (is_iterable($result) ? $result : [$result] as $created) {
                if ($created instanceof Model && $created->wasRecentlyCreated) {
                    $this->journal($account, $created, TestingChange::CREATED, null, $admin);
                }
            }

            return $result;
        });
    }

    private function journal(User $account, Model $subject, string $action, ?array $old, User $admin): void
    {
        TestingChange::create([
            'user_id' => $account->id,
            'subject_type' => $subject::class,
            'subject_id' => $subject->getKey(),
            'action' => $action,
            'old_values' => $old,
            'created_by' => $admin->id,
        ]);
    }

    private static function raw(mixed $value): ?string
    {
        return match (true) {
            $value === null => null,
            is_bool($value) => $value ? '1' : '0',
            $value instanceof \DateTimeInterface => $value->format('Y-m-d H:i:s'),
            default => (string) $value,
        };
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    public function testRecipient(int $id): User
    {
        $user = User::where('role', 'recipient')->whereNotNull('testing_added_at')->find($id);
        if (!$user) {
            throw new NotFoundHttpException(self::MSG_NOT_TEST);
        }

        return $user;
    }

    private function currentAssignment(User $recipient): Assignment
    {
        $assignment = Assignment::where('user_id', $recipient->id)->where('status', 'active')->latest('id')->first();
        if (!$assignment) {
            throw new UnprocessableEntityHttpException('This recipient has no current term.');
        }

        return $assignment;
    }

    /** The term a renewal targets: the open renewal period, else the one after this term. */
    private function nextTerm(Assignment $assignment): array
    {
        $target = SemesterPeriodService::renewalTarget();
        if ($target && ($target->academic_year !== $assignment->academic_year || $target->semester !== $assignment->semester)) {
            return [$target->academic_year, $target->semester];
        }

        [$a, $b] = array_map('intval', explode('-', $assignment->academic_year));

        return match ($assignment->semester) {
            '1st Semester' => [$assignment->academic_year, '2nd Semester'],
            '2nd Semester' => [$assignment->academic_year, 'Summer'],
            default => [($a + 1) . '-' . ($b + 1), '1st Semester'],
        };
    }

    private function attachSampleDocument(Application $application, string $type): void
    {
        $disk = config('filesystems.documents_disk', 'public');
        $path = "documents/{$application->id}/test-{$type}.pdf";
        Storage::disk($disk)->put($path, self::samplePdf("SWAP test document: {$type}"));
        ApplicationDocument::create([
            'application_id' => $application->id,
            'document_type' => $type,
            'file_path' => $path,
            'file_url' => rtrim(config('app.url'), '/') . '/api/documents/{DOC_ID}/file',
            'file_name' => "test-{$type}.pdf",
            'file_size' => strlen(self::samplePdf("SWAP test document: {$type}")),
            'mime_type' => 'application/pdf',
        ]);
    }

    /** A minimal one-page PDF with one line of text (no PDF library needed). */
    private static function samplePdf(string $text): string
    {
        $text = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
        $stream = "BT /F1 18 Tf 72 720 Td ({$text}) Tj ET";
        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
            '<< /Length ' . strlen($stream) . " >>\nstream\n{$stream}\nendstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ];
        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $i => $obj) {
            $offsets[] = strlen($pdf);
            $pdf .= ($i + 1) . " 0 obj\n{$obj}\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 " . (count($objects) + 1) . "\n0000000000 65535 f \n";
        foreach ($offsets as $o) {
            $pdf .= str_pad((string) $o, 10, '0', STR_PAD_LEFT) . " 00000 n \n";
        }

        return $pdf . "trailer\n<< /Size " . (count($objects) + 1) . " /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
    }

    private function audit(string $action, Assignment $assignment, ?array $data, User $admin): void
    {
        AuditLog::record($action, $assignment, null, $data, $admin->id);
    }
}
