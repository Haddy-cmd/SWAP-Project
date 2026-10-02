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
 * picked accounts only (TestingService).
 */
class TestingController extends Controller
{
    public const ACTIONS = [
        'hours', 'complete-hours', 'reset-hours', 'clock-in', 'auto-clock-out', 'end-term', 'file-promissory', 'close-term',
        'makeup-overdue', 'term-report', 'evaluation', 'renewal', 'reset-term',
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
        $this->testing->setEnabled($request->user(), (bool) $data['enabled']);

        return response()->json([
            'data' => $this->testing->status(),
            'message' => $data['enabled'] ? 'System Testing is on.' : 'System Testing is off. Picked accounts follow the normal rules again.',
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
        $data = $request->validate(['undo' => ['required', 'boolean']]);
        $result = $this->testing->removeExisting($request->user(), $id, (bool) $data['undo']);

        $message = $data['undo']
            ? "Removed from System Testing. {$result['undone']} " . ($result['undone'] === 1 ? 'change' : 'changes') . ' undone.'
            : 'Removed from System Testing. The changes were kept.';

        return response()->json([
            'data' => $this->testing->status(),
            'message' => trim($message . ' ' . implode(' ', $result['kept'])),
            'kept' => $result['kept'],
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
            'clock-in' => ($this->testing->clockInNow($recipient, $admin) ? 'Clocked in now. The student can clock out by scanning their office QR.' : ''),
            'auto-clock-out' => ($this->testing->autoClockOut($recipient, $admin)
                ? "Clocked out automatically, as the 12-hour safety net does. The log now waits for the supervisor's review." : ''),
            'end-term' => ($this->testing->endTerm($recipient, $admin) ? 'Term ended yesterday. Promissory notes and term-end rules now apply.' : ''),
            'file-promissory' => ($this->testing->fileNote($recipient, $admin) ? 'Promissory note filed. Their supervisor can review it now.' : ''),
            'close-term' => 'Term closed: ' . ($this->testing->closeTerm($recipient, $admin)->term_status ?? 'in progress') . '.',
            'makeup-overdue' => ($this->testing->makeupOverdue($recipient, $admin) ? 'The makeup deadline is now overdue.' : ''),
            'term-report' => ($this->testing->submitTermReport($recipient, $admin) ? 'End-of-term report submitted.' : ''),
            'evaluation' => (function () use ($request, $recipient, $admin) {
                $data = $request->validate(['rating' => ['required', 'integer', 'between:1,5']]);
                $this->testing->evaluate($recipient, (int) $data['rating'], $admin);

                return "Evaluated {$data['rating']}/5.";
            })(),
            'renewal' => (function () use ($recipient, $admin) {
                $app = $this->testing->submitRenewal($recipient, $admin);

                return "Renewal submitted for {$app->semester} {$app->academic_year}. Review it under Applications → Renewals.";
            })(),
            'reset-term' => ($this->testing->resetTerm($recipient, $admin) ? 'Term reset to in progress.' : ''),
        };

        return response()->json(['message' => $message, 'data' => $this->testing->status()]);
    }

    // Works with the switch off too: every picked account leaves testing, changes undone.
    public function releaseAll(Request $request): JsonResponse
    {
        $count = $this->testing->releaseAll($request->user());

        return response()->json([
            'data' => $this->testing->status(),
            'message' => $count === 1 ? '1 account removed from System Testing; its changes were undone.' : "{$count} accounts removed from System Testing; their changes were undone.",
        ]);
    }
}
