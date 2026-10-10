<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\StipendHistory;
use App\Models\User;
use App\Notifications\StipendRequirementsReminderNotification;
use App\Services\StipendReminderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin → Stipend v2: "Can't release yet" → Remind, and the History summary. */
class StipendReminderTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    /** A recipient whose term's hours are done (payable), with or without a signature and a report. */
    private function payable(bool $signature, bool $report): User
    {
        $recipient = $this->makeUser('recipient', $signature ? [] : ['signature_image_path' => null]);
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'), null, ['required_hours' => 3]);
        $this->makeClosedLog($assignment, 4);
        if ($report) {
            $this->submitTermReport($assignment);
        }

        return $recipient;
    }

    public function test_only_blocked_recipients_are_reminded_of_what_is_missing_once_a_day(): void
    {
        Notification::fake();
        $noSignature = $this->payable(signature: false, report: true);
        $noReport = $this->payable(signature: true, report: false);
        $ready = $this->payable(signature: true, report: true);
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);

        $this->postJson('/api/admin/stipend/remind', ['user_ids' => [$noSignature->id, $ready->id]])->assertOk()
            ->assertJsonPath('data.reminded', 1)->assertJsonPath('data.not_blocked', 1);
        Notification::assertSentTo($noSignature, StipendRequirementsReminderNotification::class,
            fn ($n) => str_contains($n->toArray($noSignature)['message'], 'save your digital signature on your Profile'));
        Notification::assertNotSentTo($ready, StipendRequirementsReminderNotification::class);

        // Remind all: the other blocked one now; the first was already reminded today.
        $this->postJson('/api/admin/stipend/remind')->assertOk()
            ->assertJsonPath('data.reminded', 1)->assertJsonPath('data.already_today', 1);
        Notification::assertSentTo($noReport, StipendRequirementsReminderNotification::class,
            fn ($n) => str_contains($n->toArray($noReport)['message'], 'submit your end-of-term report on the Hours & Attendance page'));
        Notification::assertSentToTimes($noSignature, StipendRequirementsReminderNotification::class, 1);

        $log = AuditLog::where('action', StipendReminderService::ACTION)->where('auditable_id', $noReport->id)->firstOrFail();
        $this->assertSame($admin->id, $log->user_id);
        $this->assertSame([StipendReminderService::REPORT], $log->new_values['missing']);
    }

    public function test_only_admins_may_remind(): void
    {
        Sanctum::actingAs($this->makeUser('supervisor'));
        $this->postJson('/api/admin/stipend/remind')->assertStatus(403);
    }

    public function test_history_summary_and_the_released_filter_include_legacy_stubs(): void
    {
        $make = fn (string $status, float $amount) => StipendHistory::create([
            'user_id' => $this->makeUser('recipient')->id, 'amount' => $amount, 'academic_year' => '2024-2025',
            'semester' => '1st Semester', 'status' => $status,
        ]);
        $make(StipendHistory::STATUS_RELEASED, 5000);
        $make(StipendHistory::STATUS_CERTIFIED, 5000); // legacy ready-to-claim, released now
        $make(StipendHistory::STATUS_CLAIMED, 1000);   // legacy received at the Banking Office
        $make(StipendHistory::STATUS_VOID, 5000);

        Sanctum::actingAs($this->makeUser('admin'));
        // Released = every paid stub (legacy received included); received = opened or collected.
        $this->getJson('/api/admin/stipend?status=released')->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('meta.summary.paid_out', 11000)
            ->assertJsonPath('meta.summary.released', 3)
            ->assertJsonPath('meta.summary.received', 1)
            ->assertJsonPath('meta.summary.legacy_received', 1)
            ->assertJsonPath('meta.summary.void', 1);
        $this->getJson('/api/admin/stipend?status=void')->assertOk()->assertJsonCount(1, 'data');
    }
}
