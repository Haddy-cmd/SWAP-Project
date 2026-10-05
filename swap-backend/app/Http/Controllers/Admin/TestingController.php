<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\TestingService;
use App\Support\TestTools;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Admin → System Testing. The page and its switch are always there for admins; picking
 * accounts and the shortcuts need the switch on (409 otherwise). Every action touches
 * picked accounts only, and switching off (or removing an account) restores each one to
 * how it was when picked (TestingService).
 */
class TestingController extends Controller
{
    public const ACTIONS = [
        'hours', 'complete-hours', 'reset-hours', 'verify-hours', 'clock-in', 'auto-clock-out', 'end-term', 'file-promissory',
        'approve-promissory', 'reject-promissory', 'close-term', 'term-report', 'review-report', 'renewal',
        'reset-term', 'release-stub', 'reset-stipend',
    ];

    public function __construct(private readonly TestingService $testing) {}

    private function guard(): void
    {
        abort_unless(TestTools::enabled(), 409, TestTools::MSG_OFF);
    }

    public function status(): JsonResponse
    {
        return response()->json(['data' => $this->testing->status()]);
    }

    public function switch(Request $request): JsonResponse
    {
        $data = $request->validate(['enabled' => ['required', 'boolean']]);
        $restored = $this->testing->setEnabled($request->user(), (bool) $data['enabled']);

        return response()->json([
            'data' => $this->testing->status(),
            'message' => match (true) {
                (bool) $data['enabled'] => 'System Testing is on.',
                $restored === 0 => 'System Testing is off.',
                default => $restored === 1 ? 'System Testing is off. 1 account was restored to how it was when picked.' : "System Testing is off. {$restored} accounts were restored to how they were when picked.",
            },
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
        $this->guard();
        $user = $this->testing->addExisting($request->user(), $id);

        return response()->json([
            'data' => $this->testing->status(),
            'message' => "{$user->name} was added to System Testing.",
        ]);
    }

    // Works with the switch off too, so picked accounts can always be released.
    public function removeAccount(Request $request, int $id): JsonResponse
    {
        $this->testing->removeExisting($request->user(), $id);

        return response()->json([
            'data' => $this->testing->status(),
            'message' => 'Restored to how it was when picked and removed from System Testing.',
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
        $this->guard();
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

    // Works with the switch off too: every picked account is restored and leaves testing.
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
