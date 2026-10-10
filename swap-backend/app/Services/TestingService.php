<?php

namespace App\Services;

use App\Models\Application;
use App\Models\ApplicationDocument;
use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\PromissoryNote;
use App\Models\StipendHistory;
use App\Models\TermReport;
use App\Models\TestingSnapshot;
use App\Models\TimeLog;
use App\Models\User;
use App\Support\AccountSnapshot;
use App\Support\TestTools;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * Admin → System Testing on existing accounts: the admin picks real recipients or
 * applicants, and shortcuts move their data into the state a test needs (end a term now,
 * add verified hours, file a promissory note…), so time-gated flows can be walked without
 * waiting. The real rules then run on that data. Picking an account copies its whole
 * record (AccountSnapshot); removing it, or switching testing off, puts that copy back —
 * whatever changed it in the meantime, the buttons or the normal pages.
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
    public const MSG_NO_PENDING_HOURS = 'This recipient has no hours waiting for verification.';
    public const MSG_NO_PENDING_NOTE = 'This recipient has no promissory note waiting for review.';
    public const MSG_NO_SUPERVISOR = 'This recipient has no supervisor on their placement.';
    public const MSG_NOTHING_TO_CLEAN = 'Nothing is left from an earlier test on this account.';

    /** Stub statuses that count as paid or payable (a void one doesn't). */
    private const LIVE_STIPEND = StipendHistory::LIVE_STATUSES;

    /** Audit actions that record a term's verdict, with the old one in old_values. */
    private const VERDICT_ACTIONS = ['term_closed', 'term_requalified', 'term_marked_deficient'];

    private const PICKABLE_ROLES = ['recipient', 'applicant'];

    private const TZ = 'Asia/Manila';

    /** Hours per day "Complete hours" logs. */
    private const DAY_HOURS = 8;

    /** The `attendance:close-stale` default: a shift open this long is force-closed. */
    private const STALE_HOURS = 12;

    public function __construct(
        private readonly TermReportReviewService $reportReviews,
        private readonly TermStatusService $termStatus,
        private readonly PromissoryService $promissory,
        private readonly AttendanceService $attendance,
        private readonly VerificationService $verification,
        private readonly StipendClaimService $stipendClaims,
        private readonly AccountSnapshot $snapshots,
    ) {}

    // ── Switch ──────────────────────────────────────────────────────────────

    /**
     * Switching off ends testing: every picked account is restored to how it was when
     * picked and leaves testing. Returns how many accounts were restored.
     */
    public function setEnabled(User $admin, bool $on): int
    {
        $restored = $on ? 0 : $this->releaseAll($admin);

        $was = TestTools::enabled();
        TestTools::setEnabled($on);
        if ($was !== $on) {
            AuditLog::record($on ? 'testing_switched_on' : 'testing_switched_off', $admin, ['enabled' => $was], ['enabled' => $on], $admin->id);
        }

        return $restored;
    }

    public const MSG_NO_RESTORE_POINT = 'This account was picked before restore points existed — use Remove to clean it up.';

    public static function msgSameRole(string $role): string
    {
        return 'This account is already '.($role === 'applicant' ? 'an' : 'a')." {$role}.";
    }

    /** A picked account's email switch: muted = bell notifications only (TestTools::mutesEmail). */
    public function setAccountEmail(User $admin, int $id, bool $muted): User
    {
        $user = $this->picked($id);
        $was = (bool) $user->testing_email_muted;
        if ($was !== $muted) {
            $user->forceFill(['testing_email_muted' => $muted])->save();
            AuditLog::record($muted ? 'testing_email_off' : 'testing_email_on', $user, ['email_muted' => $was], ['email_muted' => $muted], $admin->id);
        }

        return $user;
    }

    /**
     * Flip a picked account between applicant and recipient — the role only: applications and
     * placements are not touched. Restore (or switching testing off) puts the original role back.
     */
    public function setRole(User $admin, int $id, string $role): User
    {
        $user = $this->picked($id);
        if ($user->role === $role) {
            throw new UnprocessableEntityHttpException(self::msgSameRole($role));
        }
        $old = $user->role;
        $user->forceFill(['role' => $role])->save();
        AuditLog::record('testing_role_changed', $user, ['role' => $old], ['role' => $role], $admin->id);

        return $user;
    }

    private function picked(int $id): User
    {
        $user = User::whereNotNull('testing_added_at')->find($id);
        if (!$user) {
            throw new NotFoundHttpException(self::MSG_NOT_PICKED);
        }

        return $user;
    }

    // ── Overview ────────────────────────────────────────────────────────────

    public function status(): array
    {
        $users = User::with('profile')->whereNotNull('testing_added_at')->orderBy('role')->orderBy('testing_added_at')->get();
        $withSnapshot = TestingSnapshot::whereIn('user_id', $users->pluck('id'))->pluck('user_id')->flip();

        $assignments = Assignment::with(['termReport'])
            ->withPromissoryFlags()
            ->whereIn('user_id', $users->pluck('id'))
            ->orderByDesc('id')
            ->get()
            ->groupBy('user_id');
        $applications = Application::whereIn('user_id', $users->pluck('id'))->orderByDesc('id')->get()->groupBy('user_id');
        $openShifts = TimeLog::whereIn('user_id', $users->pluck('id'))->where('status', 'open')->get(['user_id', 'time_in'])->keyBy('user_id');
        $stubs = StipendHistory::whereIn('user_id', $users->pluck('id'))->whereIn('status', self::LIVE_STIPEND)
            ->orderBy('id')->get(['user_id', 'academic_year', 'semester', 'status'])
            ->keyBy(fn ($s) => "{$s->user_id}|{$s->academic_year}|{$s->semester}");

        return [
            'enabled' => TestTools::enabled(),
            'accounts' => $users->map(fn (User $u) => [
                'id' => $u->id,
                'role' => $u->role,
                'name' => $u->name,
                'email' => $u->email,
                'student_id_number' => $u->profile?->student_id_number,
                // Removing the account (or switching off) restores it to this moment.
                'picked_at' => $u->testing_added_at?->toISOString(),
                // False only for accounts picked before restore points existed.
                'restorable' => $withSnapshot->has($u->id),
                // Its email switch: true = bell notifications only, no emails (default when picked).
                'email_muted' => (bool) $u->testing_email_muted,
                'clocked_in_since' => $openShifts->get($u->id)?->time_in?->toISOString(),
                'assignments' => ($assignments[$u->id] ?? collect())->map(fn (Assignment $a) => [
                    'id' => $a->id,
                    'term' => "{$a->semester} {$a->academic_year}",
                    'status' => $a->status,
                    'required_hours' => $a->required_hours,
                    'verified_hours' => round($a->verified_hours, 2),
                    'pending_hours' => round($a->pending_hours, 2),
                    'end_date' => $a->effectiveEndDate()?->toDateString(),
                    'term_badge' => $a->termBadge(),
                    'report_submitted' => $a->termReport?->submitted_at !== null,
                    // The supervisor's acceptance: null until accepted, then eligible or not.
                    'report_eligible' => $a->termReport?->reviewed_at ? (bool) $a->termReport->renewal_eligible : null,
                    'promissory' => $a->has_approved_promissory ? 'approved' : ($a->has_pending_promissory ? 'pending' : null),
                    // The term's stub status: released (legacy: claimed / certified), or void.
                    'stipend' => $stubs->get("{$a->user_id}|{$a->academic_year}|{$a->semester}")?->status,
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
        // Verified hours can lift a Deficient result.
        if ($status === 'verified') {
            $this->termStatus->refreshById($assignment->id);
        }
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
        $assignment->update($changes);
        $this->audit('testing_term_ended', $assignment, $changes, $admin);

        return $assignment->fresh();
    }

    /** Record the Qualified/Deficient verdict now, for this term only. */
    public function closeTerm(User $recipient, User $admin): Assignment
    {
        $assignment = $this->currentAssignment($recipient);
        $this->termStatus->close($assignment);
        $this->audit('testing_term_closed', $assignment, ['term_status' => $assignment->fresh()->term_status], $admin);

        return $assignment->fresh();
    }

    public function submitTermReport(User $recipient, User $admin): TermReport
    {
        $assignment = $this->currentAssignment($recipient);
        $report = TermReport::updateOrCreate(['assignment_id' => $assignment->id], [
            'user_id' => $recipient->id,
            'content' => str_repeat('Test end-of-term report: assisted the office with filing, records and student queries. ', 2),
            'submitted_at' => now(),
        ]);
        $this->audit('testing_term_report', $assignment, null, $admin);

        return $report;
    }

    /** Accept the end-of-term report as the placement's supervisor, eligible or not for renewal. */
    public function reviewReport(User $recipient, bool $eligible, User $admin): TermReport
    {
        $assignment = $this->currentAssignment($recipient);
        $report = $this->reportReviews->review($this->supervisorOf($assignment), $assignment, $eligible, 'System Testing review.');
        $this->audit('testing_report_reviewed', $assignment, ['renewal_eligible' => $eligible], $admin);

        return $report;
    }

    /** A renewal for the next term with a sample COR, even while renewal is closed. */
    public function submitRenewal(User $recipient, User $admin): Application
    {
        $assignment = $this->currentAssignment($recipient);
        [$year, $semester] = $this->nextTerm($assignment);

        if (Application::where('user_id', $recipient->id)->where('academic_year', $year)->where('semester', $semester)->exists()) {
            throw new UnprocessableEntityHttpException("This recipient already has a submission for {$semester} {$year}.");
        }

        $application = Application::create([
            'user_id' => $recipient->id, 'academic_year' => $year, 'semester' => $semester,
            'status' => 'submitted', 'type' => 'renewal',
        ]);
        $this->attachSampleDocument($application, 'cor');
        $this->audit('testing_renewal_submitted', $assignment, ['application_id' => $application->id, 'term' => "{$semester} {$year}"], $admin);

        return $application;
    }

    /** Back to "in progress": clears the verdict and the term-end shortcut. */
    public function resetTerm(User $recipient, User $admin): Assignment
    {
        $assignment = $this->currentAssignment($recipient);
        $hasPeriod = $assignment->semesterPeriod() !== null;
        $assignment->update([
            'term_status' => null, 'deficient_hours' => null, 'term_status_at' => null,
            'term_status_by' => null, 'term_status_reason' => null,
            'end_date' => $hasPeriod ? null : Carbon::now(self::TZ)->addMonths(4)->toDateString(),
        ]);
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

        $days = DB::transaction(function () use ($assignment, $recipient, $missing) {
            $days = 0;
            $left = $missing;
            $day = Carbon::now(self::TZ)->subDay()->startOfDay();
            while ($left > 0) {
                if ($day->isSunday()) {
                    $day->subDay();
                    continue;
                }
                $hours = min(self::DAY_HOURS, $left);
                $in = $day->copy()->setTime(8, 0)->utc();
                TimeLog::create([
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
                $days++;
                $left = round($left - $hours, 2);
                $day->subDay();
            }
            $this->termStatus->refreshById($assignment->id);

            return $days;
        });
        $this->audit('testing_hours_completed', $assignment, ['hours' => $missing, 'days' => $days], $admin);

        return ['hours' => $missing, 'days' => $days];
    }

    /**
     * Back to 0 hours for the current term: every time log of it is removed (with its
     * narrative report and verifications), so the term can be tested from scratch. Files
     * stay; the restore at the end of testing brings the logs back.
     *
     * @return array{logs: int, hours: float}
     */
    public function resetHours(User $recipient, User $admin): array
    {
        $assignment = $this->currentAssignment($recipient);
        $ids = TimeLog::where('assignment_id', $assignment->id)->pluck('id');
        if ($ids->isEmpty()) {
            throw new UnprocessableEntityHttpException(self::MSG_NO_HOURS);
        }
        $hours = round((float) $assignment->verified_hours, 2);

        // Plain delete (no model events): narrative reports and verifications cascade.
        TimeLog::whereIn('id', $ids)->toBase()->delete();
        $this->audit('testing_hours_reset', $assignment, ['logs' => $ids->count(), 'verified_hours' => $hours], $admin);

        return ['logs' => $ids->count(), 'hours' => $hours];
    }

    /**
     * Back to "eligible" for the current term's stipend: the stub (with its signatures) is
     * removed, so the student is listed again under Admin → Stipend and the whole release
     * can be tested again. Files stay; the restore at the end of testing brings it back.
     *
     * @return array{stubs: int, term: string}
     */
    public function resetStipend(User $recipient, User $admin): array
    {
        $assignment = $this->currentAssignment($recipient);
        $term = "{$assignment->semester} {$assignment->academic_year}";
        $ids = StipendHistory::where('user_id', $recipient->id)
            ->where('academic_year', $assignment->academic_year)->where('semester', $assignment->semester)
            ->whereIn('status', self::LIVE_STIPEND)->pluck('id');
        if ($ids->isEmpty()) {
            throw new UnprocessableEntityHttpException("This recipient has no stipend stub for {$term}.");
        }

        StipendHistory::whereIn('id', $ids)->toBase()->delete();
        $this->audit('testing_stipend_reset', $assignment, ['stipend_ids' => $ids->all()], $admin);

        return ['stubs' => $ids->count(), 'term' => $term];
    }

    // ── Other people's steps, through the real services ─────────────────────

    /**
     * Verify every log waiting for review, as the placement's supervisor (the real
     * VerificationService: same events and notifications).
     *
     * @return array{logs: int, hours: float, supervisor: string}
     */
    public function verifyHours(User $recipient, User $admin): array
    {
        $assignment = $this->currentAssignment($recipient);
        $supervisor = $this->supervisorOf($assignment);
        $logs = TimeLog::where('assignment_id', $assignment->id)->where('status', 'pending_verification')->orderBy('id')->get();
        if ($logs->isEmpty()) {
            throw new UnprocessableEntityHttpException(self::MSG_NO_PENDING_HOURS);
        }

        DB::transaction(function () use ($logs, $supervisor) {
            foreach ($logs as $log) {
                $this->verification->verify($log, $supervisor, 'verified');
            }
        });
        $hours = round((float) $logs->sum('duration_hours'), 2);
        $this->audit('testing_hours_verified', $assignment, ['logs' => $logs->count(), 'hours' => $hours], $admin);

        return ['logs' => $logs->count(), 'hours' => $hours, 'supervisor' => $supervisor->name];
    }

    /**
     * Approve or reject the pending promissory note as the placement's supervisor (the
     * real PromissoryService::review). Approval records the lacking hours the note asked for.
     */
    public function reviewNote(User $recipient, User $admin, bool $approve): PromissoryNote
    {
        $assignment = $this->currentAssignment($recipient);
        $supervisor = $this->supervisorOf($assignment);
        $note = PromissoryNote::where('assignment_id', $assignment->id)->where('status', PromissoryNote::STATUS_PENDING)->latest('id')->first();
        if (!$note) {
            throw new UnprocessableEntityHttpException(self::MSG_NO_PENDING_NOTE);
        }

        $data = $approve ? ['action' => 'approve', 'lacking_hours' => (float) $note->lacking_hours] : ['action' => 'reject'];
        $reviewed = $this->promissory->review($supervisor, $note, $data);
        $this->audit($approve ? 'testing_promissory_approved' : 'testing_promissory_rejected', $assignment, ['promissory_note_id' => $note->id], $admin);

        return $reviewed;
    }

    /** Release the term's stipend as the admin would (Admin → Stipend), with the real checks. */
    public function releaseStub(User $recipient, User $admin): StipendHistory
    {
        $assignment = $this->currentAssignment($recipient);
        $stub = $this->stipendClaims->releaseClaimStub([
            'user_id' => $recipient->id,
            'academic_year' => $assignment->academic_year,
            'semester' => $assignment->semester,
        ], $admin);
        $this->audit('testing_stub_released', $assignment, ['stipend_id' => $stub->id], $admin);

        return $stub;
    }

    private function supervisorOf(Assignment $assignment): User
    {
        $supervisor = $assignment->supervisor_id ? User::find($assignment->supervisor_id) : null;
        if (!$supervisor) {
            throw new UnprocessableEntityHttpException(self::MSG_NO_SUPERVISOR);
        }

        return $supervisor;
    }

    /** File a promissory note for the student, with a sample PDF — through the real rules. */
    public function fileNote(User $recipient, User $admin): PromissoryNote
    {
        $assignment = $this->currentAssignment($recipient);
        $tmp = tempnam(sys_get_temp_dir(), 'swap-note');
        file_put_contents($tmp, self::samplePdf('SWAP System Testing: sample promissory note'));

        try {
            $file = new UploadedFile($tmp, 'promissory-note.pdf', 'application/pdf', null, true);
            $note = $this->promissory->submit($recipient, ['assignment_id' => $assignment->id], $file);
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
        $log = TimeLog::create([
            'assignment_id' => $assignment->id,
            'user_id' => $recipient->id,
            'date' => Carbon::today()->toDateString(),
            'time_in' => now(),
            'status' => 'open',
        ]);
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

        $this->attendance->closeStaleLog($log, self::STALE_HOURS);
        $this->audit('testing_auto_clocked_out', $log->assignment, ['time_log_id' => $log->id], $admin);

        return $log->fresh();
    }

    // ── Existing accounts: pick, restore ────────────────────────────────────

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

    /** Pick an account: copy its whole record first, so the end of testing can put it back. */
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

        DB::transaction(function () use ($user) {
            $now = now();
            // The restore point keeps the role too (the role buttons change it).
            TestingSnapshot::updateOrCreate(['user_id' => $user->id], ['taken_at' => $now, 'data' => $this->snapshots->take($user) + ['role' => $user->role]]);
            // Emails start off: a tested account's inbox gets no notification emails.
            $user->forceFill(['testing_added_at' => $now, 'testing_email_muted' => true])->save();
        });
        AuditLog::record('testing_account_added', $user, null, ['email' => $user->email], $admin->id);

        return $user;
    }

    /**
     * Put a picked account back to how it was when it was picked (whatever changed it since),
     * role included. It stays in testing with the same restore point, so it can be restored
     * again. Works while the tools are off too.
     *
     * @return array{removed: int, restored: int, files: int, notifications: int}
     */
    public function restoreExisting(User $admin, int $id): array
    {
        $user = $this->picked($id);
        $snapshot = TestingSnapshot::where('user_id', $user->id)->first();
        if (!$snapshot) {
            throw new UnprocessableEntityHttpException(self::MSG_NO_RESTORE_POINT);
        }

        $counts = $this->restoreRecord($user, $snapshot);
        AuditLog::record('testing_account_restored', $user, null, $counts, $admin->id);

        return $counts;
    }

    /**
     * Take a picked account out of testing as it is now: what was done to it while tested stays
     * (Restore first to undo it). An account picked before restore points existed is cleaned up
     * from the audit log instead, as before. Works while the tools are off too.
     */
    public function removeExisting(User $admin, int $id): void
    {
        $user = $this->picked($id);
        $snapshot = TestingSnapshot::where('user_id', $user->id)->first();
        if (!$snapshot) {
            // Picked before restore points existed: clean up from the audit log instead.
            $plan = $this->earlierTestPlan($user);
            $plan ? $this->applyCleanup($admin, $user, $plan) : $this->unpick($user);

            return;
        }

        DB::transaction(function () use ($user, $snapshot) {
            $snapshot->delete();
            $this->unpick($user);
        });
        AuditLog::record('testing_account_removed', $user, null, ['restored' => false], $admin->id);
    }

    /** Restore every picked account and take it out of testing (switching testing off). Returns how many. */
    public function releaseAll(User $admin): int
    {
        $ids = User::whereNotNull('testing_added_at')->pluck('id');
        foreach ($ids as $id) {
            $user = User::find($id);
            $snapshot = TestingSnapshot::where('user_id', $id)->first();
            if (!$snapshot) {
                $this->removeExisting($admin, $id); // older picks: the audit-log cleanup

                continue;
            }
            $counts = $this->restoreRecord($user, $snapshot);
            DB::transaction(function () use ($user, $snapshot) {
                $snapshot->delete();
                $this->unpick($user);
            });
            AuditLog::record('testing_account_removed', $user, null, ['restored' => true] + $counts, $admin->id);
        }
        if ($ids->isNotEmpty()) {
            AuditLog::record('testing_released_all', $admin, null, ['accounts' => $ids->count()], $admin->id);
        }

        return $ids->count();
    }

    /**
     * The account's data back to the restore point, and its role (restore points taken before
     * the role buttons existed don't carry one: the role is left as it is).
     *
     * @return array{removed: int, restored: int, files: int, notifications: int}
     */
    private function restoreRecord(User $user, TestingSnapshot $snapshot): array
    {
        $counts = $this->snapshots->restore($user, $snapshot->data, $snapshot->taken_at);
        $role = $snapshot->data['role'] ?? null;
        if ($role && $user->fresh()->role !== $role) {
            $user->forceFill(['role' => $role])->save();
        }

        return $counts;
    }

    private function unpick(User $user): void
    {
        $user->forceFill(['testing_added_at' => null, 'testing_email_muted' => true])->save();
    }

    // ── Accounts tested before restore points existed ───────────────────────

    /**
     * Accounts with something left over from a test run before snapshots existed (or
     * still picked from then), each with what a cleanup would do.
     *
     * @return list<array{id: int, name: string, email: string, student_id_number: ?string, picked: bool, tested: list<string>, items: list<string>}>
     */
    public function earlierTests(): array
    {
        $ids = AuditLog::where('action', 'testing_account_added')->where('auditable_type', User::class)
            ->distinct()->pluck('auditable_id');

        return User::with('profile')->whereIn('id', $ids)->whereIn('role', self::PICKABLE_ROLES)->orderBy('name')->get()
            ->map(function (User $u) {
                $plan = $this->earlierTestPlan($u);
                $stillPicked = $u->testing_added_at !== null && !TestingSnapshot::where('user_id', $u->id)->exists();
                if (!$plan || (!$plan['items'] && !$stillPicked)) {
                    return null;
                }

                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'student_id_number' => $u->profile?->student_id_number,
                    'picked' => $stillPicked,
                    'tested' => array_map(fn ($w) => $w['start']->timezone(self::TZ)->format('M j, Y g:i A')
                        . ' – ' . $w['end']->timezone(self::TZ)->format('M j, Y g:i A'), $plan['windows']),
                    'items' => $plan['items'],
                ];
            })->filter()->values()->all();
    }

    /**
     * Clean up an account tested before snapshots existed: everything created for it while
     * it was in testing goes (with files and bell entries), its earlier placement becomes
     * active again if a renewal replaced it, and its term result goes back to what it was.
     *
     * @return list<string> what was done
     */
    public function cleanUpEarlierTest(User $admin, int $id): array
    {
        $user = User::find($id);
        $plan = $user ? $this->earlierTestPlan($user) : null;
        if (!$plan) {
            throw new UnprocessableEntityHttpException(self::MSG_NOTHING_TO_CLEAN);
        }

        return $this->applyCleanup($admin, $user, $plan);
    }

    /** @return list<string> */
    private function applyCleanup(User $admin, User $user, array $plan): array
    {
        DB::transaction(function () use ($user, $plan) {
            $this->snapshots->deleteRows($user->id, $plan['rows'], $plan['windows']);
            if ($plan['reactivate']) {
                DB::table('assignments')->where('id', $plan['reactivate'])->update(['status' => 'active', 'updated_at' => now()]);
            }
            foreach ($plan['verdicts'] as $assignmentId => $old) {
                $values = ['term_status' => $old['term_status'] ?? null, 'deficient_hours' => $old['deficient_hours'] ?? null];
                if ($values['term_status'] === null) {
                    $values += ['term_status_at' => null, 'term_status_by' => null, 'term_status_reason' => null];
                }
                DB::table('assignments')->where('id', $assignmentId)->update($values + ['updated_at' => now()]);
            }
            TestingSnapshot::where('user_id', $user->id)->delete();
            $user->forceFill(['testing_added_at' => null])->save();
        });
        AuditLog::record('testing_legacy_cleanup', $user, null, ['items' => $plan['items']], $admin->id);

        return $plan['items'];
    }

    /**
     * What a cleanup of an earlier test would do: the test windows (picked → removed) from
     * the audit log since the last cleanup, the rows created inside them, the placement to
     * reactivate and the term results to put back. Null when there's no earlier test.
     */
    private function earlierTestPlan(User $user): ?array
    {
        $windows = $this->earlierTestWindows($user);
        if (!$windows) {
            return null;
        }

        $all = $this->snapshots->current($user->id);
        $selected = [];
        foreach ($all as $table => $rows) {
            foreach ($rows as $id => $row) {
                if (!empty($row['created_at']) && self::inWindows(Carbon::parse($row['created_at']), $windows)) {
                    $selected[$table][$id] = $row;
                }
            }
        }
        $selected = AccountSnapshot::withChildren($selected, $all);

        // A renewal approved during the test replaced the placement: make it active again.
        $remaining = array_diff_key($all['assignments'], $selected['assignments'] ?? []);
        $reactivate = null;
        if (!empty($selected['assignments']) && $remaining && !collect($remaining)->contains(fn ($a) => $a['status'] === 'active')) {
            $reactivate = (int) array_key_last($remaining);
        }

        // Term results recorded during the test go back to what the first one replaced.
        $verdicts = [];
        foreach (array_keys($remaining) as $assignmentId) {
            $first = AuditLog::where('auditable_type', Assignment::class)->where('auditable_id', $assignmentId)
                ->whereIn('action', self::VERDICT_ACTIONS)
                ->where(function ($q) use ($windows) {
                    foreach ($windows as $w) {
                        $q->orWhereBetween('created_at', [$w['start'], $w['end']]);
                    }
                })->orderBy('id')->first();
            $old = $first?->old_values ?? [];
            if ($first && ($old['term_status'] ?? null) !== ($remaining[$assignmentId]['term_status'] ?? null)) {
                $verdicts[$assignmentId] = $old;
            }
        }

        return [
            'windows' => $windows,
            'rows' => $selected,
            'reactivate' => $reactivate,
            'verdicts' => $verdicts,
            'items' => $this->describe($selected, $reactivate ? $remaining[$reactivate] : null, $verdicts, $remaining),
        ];
    }

    /** @return list<array{start: Carbon, end: Carbon}> test windows without a restore, since the last cleanup */
    private function earlierTestWindows(User $user): array
    {
        $events = AuditLog::where('auditable_type', User::class)->where('auditable_id', $user->id)
            ->whereIn('action', ['testing_account_added', 'testing_account_removed', 'testing_legacy_cleanup'])
            ->orderBy('id')->get(['action', 'new_values', 'created_at']);

        $windows = [];
        $start = null;
        foreach ($events as $event) {
            if ($event->action === 'testing_legacy_cleanup') {
                $windows = [];
                $start = null;
            } elseif ($event->action === 'testing_account_added') {
                $start = $event->created_at;
            } else {
                if ($start && empty($event->new_values['restored'])) {
                    $windows[] = ['start' => $start, 'end' => $event->created_at];
                }
                $start = null;
            }
        }
        // Still picked from before restore points existed.
        if ($start && $user->testing_added_at !== null && !TestingSnapshot::where('user_id', $user->id)->exists()) {
            $windows[] = ['start' => $start, 'end' => now()];
        }

        return $windows;
    }

    private static function inWindows(Carbon $at, array $windows): bool
    {
        foreach ($windows as $w) {
            if ($at->betweenIncluded($w['start'], $w['end'])) {
                return true;
            }
        }

        return false;
    }

    /** @return list<string> */
    private function describe(array $rows, ?array $reactivate, array $verdicts, array $assignments): array
    {
        $term = fn (array $r) => "{$r['semester']} {$r['academic_year']}";
        $items = [];
        foreach ($rows['applications'] ?? [] as $r) {
            $items[] = (($r['type'] ?? 'new') === 'renewal' ? 'Renewal' : 'Application') . " for {$term($r)} ({$r['status']})";
        }
        foreach ($rows['assignments'] ?? [] as $r) {
            $items[] = "Placement for {$term($r)}";
        }
        foreach ($rows['promissory_notes'] ?? [] as $r) {
            $items[] = "Promissory note for {$term($r)} ({$r['status']})";
        }
        foreach ($rows['stipend_history'] ?? [] as $r) {
            $items[] = 'Stipend stub ' . ($r['control_number'] ?? "#{$r['id']}") . " ({$r['status']})";
        }
        if ($logs = $rows['time_logs'] ?? []) {
            $items[] = count($logs) . ' time ' . (count($logs) === 1 ? 'log' : 'logs');
        }
        if ($rows['term_reports'] ?? []) {
            $items[] = 'End-of-term report';
        }
        if ($reactivate) {
            $items[] = "Placement for {$term($reactivate)} becomes active again";
        }
        foreach ($verdicts as $id => $old) {
            $label = $old['term_status'] ?? 'in progress';
            $items[] = "Result for {$term($assignments[$id])} goes back to {$label}";
        }

        return $items;
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
