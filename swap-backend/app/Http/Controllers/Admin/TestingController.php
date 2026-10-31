<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Setting;
use App\Services\OneTimeCodeService;
use App\Services\TestingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Admin → System Testing, switched on and off only by the environment (SWAP_TEST_TOOLS; the
 * routes answer 404 while it's off — EnsureTestToolsAvailable). Every action touches picked
 * accounts only; Restore all (or turning it off on the server: 	esting:shutdown) restores
 * each one to how it was when picked (TestingService).
 */
class TestingController extends Controller
{
    public const ACTIONS = [
        'hours', 'complete-hours', 'reset-hours', 'verify-hours', 'clock-in', 'clock-out', 'auto-clock-out', 'end-term', 'file-promissory',
        'approve-promissory', 'reject-promissory', 'close-term', 'term-report', 'review-report', 'renewal',
        'reset-term', 'release-stub', 'reset-stipend',
    ];

    public function __construct(private readonly TestingService $testing) {}


    public function status(): JsonResponse
    {
        return response()->json(['data' => $this->testing->status()]);
    }


    /**
     * The portal-wide sign-in code (OTP) switch. Lowers security for every account, so the admin
     * confirms with their password. LOGIN_OTP=false on the server always wins.
     */
    public function loginCode(Request $request): JsonResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'password' => ['required', 'string', 'current_password'],
        ], ['password.current_password' => 'That password is incorrect.']);

        if (!config('auth.login_otp')) {
            return response()->json(['message' => OneTimeCodeService::MSG_SERVER_OFF], 422);
        }

        $on = (bool) $data['enabled'];
        $was = Setting::bool(OneTimeCodeService::SETTING, true);
        Setting::put(OneTimeCodeService::SETTING, $on ? '1' : '0');
        AuditLog::record('login_code_switched', $request->user(), ['enabled' => $was], ['enabled' => $on]);

        return response()->json([
            'data' => $this->testing->status(),
            'message' => $on ? 'Sign-in codes are on for everyone.' : 'Sign-in codes are off for everyone.',
        ]);
    }

    /** A picked account's email switch. */
    public function accountEmail(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['muted' => ['required', 'boolean']]);
        $user = $this->testing->setAccountEmail($request->user(), $id, (bool) $data['muted']);

        return response()->json([
            'data' => $this->testing->status(),
            'message' => $data['muted']
                ? "Emails to {$user->name} are off. They still get bell notifications; verification and password-reset emails still go out."
                : "Emails to {$user->name} are on.",
        ]);
    }

    /** Applicant ↔ recipient, the role only. */
    public function accountRole(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['role' => ['required', Rule::in(['applicant', 'recipient'])]]);
        $user = $this->testing->setRole($request->user(), $id, $data['role']);

        return response()->json([
            'data' => $this->testing->status(),
            'message' => "{$user->name} is now {$this->article($data['role'])} {$data['role']}. Restore puts the original role back.",
        ]);
    }

    private function article(string $role): string
    {
        return $role === 'applicant' ? 'an' : 'a';
    }

    public function restoreAccount(Request $request, int $id): JsonResponse
    {
        $this->testing->restoreExisting($request->user(), $id);

        return response()->json([
            'data' => $this->testing->status(),
            'message' => 'Restored to how it was when picked. It stays in System Testing.',
        ]);
    }

    /** Existing recipients/applicants the admin can pick. */
    public function candidates(Request $request): JsonResponse
    {
        $data = $request->validate(['search' => ['required', 'string', 'min:2', 'max:100']]);

        return response()->json(['data' => $this->testing->candidates($data['search'])]);
    }

    public function addAccount(Request $request, int $id): JsonResponse
    {
        $user = $this->testing->addExisting($request->user(), $id);

        return response()->json([
            'data' => $this->testing->status(),
            'message' => "{$user->name} was added to System Testing.",
        ]);
    }

    public function removeAccount(Request $request, int $id): JsonResponse
    {
        $this->testing->removeExisting($request->user(), $id);

        return response()->json([
            'data' => $this->testing->status(),
            'message' => 'Removed from System Testing. Its current record was kept.',
        ]);
    }

    /** Accounts tested before restore points existed, with what a cleanup would do. */
    public function earlierTests(): JsonResponse
    {
        return response()->json(['data' => $this->testing->earlierTests()]);
    }

    public function cleanUpEarlierTest(Request $request, int $id): JsonResponse
    {
        $done = $this->testing->cleanUpEarlierTest($request->user(), $id);

        return response()->json([
            'data' => $this->testing->status(),
            'message' => 'Earlier test cleaned up: ' . (count($done) ? implode('; ', $done) . '.' : 'nothing was left.'),
        ]);
    }

    public function action(Request $request, int $id, string $action): JsonResponse
    {
        abort_unless(in_array($action, self::ACTIONS, true), 404);

        $recipient = $this->testing->testRecipient($id);
        $admin = $request->user();

        $message = match ($action) {
            'hours' => (function () use ($request, $recipient, $admin) {
                $data = $request->validate([
                    'hours' => ['required', 'numeric', 'min:0.25', 'max:24'],
                    'date' => ['nullable', 'date'],
                    'status' => ['required', Rule::in(['verified', 'pending_verification'])],
                ]);
                $this->testing->addHours($recipient, (float) $data['hours'], $data['date'] ?? null, $data['status'], $admin);

                return $data['status'] === 'verified' ? "Added {$data['hours']} verified hours." : "Added {$data['hours']} hours awaiting verification.";
            })(),
            'complete-hours' => (function () use ($recipient, $admin) {
                ['hours' => $hours, 'days' => $days] = $this->testing->completeHours($recipient, $admin);

                return "Added {$hours} verified hours over {$days} " . ($days === 1 ? 'day' : 'days') . '. Hours are now complete.';
            })(),
            'reset-hours' => (function () use ($recipient, $admin) {
                ['logs' => $logs, 'hours' => $hours] = $this->testing->resetHours($recipient, $admin);

                return "Hours reset to 0: {$logs} time " . ($logs === 1 ? 'log' : 'logs') . " ({$hours} verified hours) set aside. Undo on Remove from testing brings them back.";
            })(),
            'verify-hours' => (function () use ($recipient, $admin) {
                ['logs' => $logs, 'hours' => $hours, 'supervisor' => $by] = $this->testing->verifyHours($recipient, $admin);

                return "Verified {$logs} pending " . ($logs === 1 ? 'log' : 'logs') . " ({$hours} hours) as {$by}.";
            })(),
            'approve-promissory' => (function () use ($recipient, $admin) {
                $note = $this->testing->reviewNote($recipient, $admin, true);

                return "Promissory note approved by the supervisor: {$note->lacking_hours} lacking hours, added to the next term if the student renews.";
            })(),
            'reject-promissory' => ($this->testing->reviewNote($recipient, $admin, false) ? 'Promissory note rejected by the supervisor.' : ''),
            'release-stub' => (function () use ($recipient, $admin) {
                $stub = $this->testing->releaseStub($recipient, $admin);

                return "Stipend released ({$stub->control_number}) with the supervisor's, director's and student's signatures.";
            })(),
            'clock-in' => ($this->testing->clockInNow($recipient, $admin) ? 'Clocked in now. The student can clock out by scanning their office QR.' : ''),
            'clock-out' => (function () use ($request, $recipient, $admin) {
                $data = $request->validate(
                    ['task' => ['nullable', 'string', 'min:10', 'max:5000']],
                    [],
                    ['task' => 'task description'],
                );
                $this->testing->clockOutNow($recipient, $admin, $data['task'] ?? null);

                return "Clocked out with the task description. The log now waits for the supervisor's review.";
            })(),
            'auto-clock-out' => ($this->testing->autoClockOut($recipient, $admin)
                ? "Clocked out automatically, as the 12-hour safety net does. The log now waits for the supervisor's review." : ''),
            'end-term' => ($this->testing->endTerm($recipient, $admin) ? 'Term ended yesterday. Promissory notes and term-end rules now apply.' : ''),
            'file-promissory' => ($this->testing->fileNote($recipient, $admin) ? 'Promissory note filed. Their supervisor can review it now.' : ''),
            'close-term' => 'Term closed: ' . ($this->testing->closeTerm($recipient, $admin)->term_status ?? 'in progress') . '.',
            'term-report' => ($this->testing->submitTermReport($recipient, $admin) ? 'End-of-term report submitted.' : ''),
            'review-report' => (function () use ($request, $recipient, $admin) {
                $data = $request->validate(['eligible' => ['required', 'boolean']]);
                $eligible = (bool) $data['eligible'];
                $this->testing->reviewReport($recipient, $eligible, $admin);

                return $eligible
                    ? 'End-of-term report accepted by the supervisor: eligible for renewal.'
                    : 'End-of-term report accepted by the supervisor: not eligible for renewal.';
            })(),
            'renewal' => (function () use ($recipient, $admin) {
                $app = $this->testing->submitRenewal($recipient, $admin);

                return "Renewal submitted for {$app->semester} {$app->academic_year}. Review it under Applications → Renewals.";
            })(),
            'reset-term' => ($this->testing->resetTerm($recipient, $admin) ? 'Term reset to in progress.' : ''),
            'reset-stipend' => (function () use ($recipient, $admin) {
                ['term' => $term] = $this->testing->resetStipend($recipient, $admin);

                return "Stipend reset for {$term}: the stub was removed, so the student is eligible again under Admin → Stipend. Undo on Remove from testing brings it back.";
            })(),
        };

        return response()->json(['message' => $message, 'data' => $this->testing->status()]);
    }

    // Restore all: every picked account is restored and leaves testing.
    public function releaseAll(Request $request): JsonResponse
    {
        $count = $this->testing->releaseAll($request->user());

        return response()->json([
            'data' => $this->testing->status(),
            'message' => $count === 1
                ? '1 account was restored to how it was when picked and removed from System Testing.'
                : "{$count} accounts were restored to how they were when picked and removed from System Testing.",
        ]);
    }
}
