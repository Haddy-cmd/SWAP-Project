<?php

namespace Tests\Feature;

use App\Models\SemesterPeriod;
use App\Notifications\TermReportDueNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** "Submit your end-of-term report" — once when the hours are met, once when the term ends. */
class TermReportReminderTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
    }

    private function period(int $endedDaysAgo): SemesterPeriod
    {
        $today = Carbon::now('Asia/Manila');

        return SemesterPeriod::create([
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'start_date' => $today->copy()->subDays($endedDaysAgo + 120)->toDateString(),
            'end_date' => $today->copy()->subDays($endedDaysAgo)->toDateString(),
        ]);
    }

    public function test_verifying_the_hours_that_complete_the_term_reminds_once(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $supervisor, null, ['required_hours' => 5]);
        $this->makeClosedLog($assignment, 3);
        $first = $this->makeClosedLog($assignment, 1, 'pending_verification', daysAgo: 1);
        $last = $this->makeClosedLog($assignment, 1, 'pending_verification', daysAgo: 0);

        Sanctum::actingAs($supervisor);
        $this->putJson("/api/supervisor/verifications/{$first->id}", ['action' => 'verified'])->assertOk();
        Notification::assertNotSentTo($recipient, TermReportDueNotification::class);

        $this->putJson("/api/supervisor/verifications/{$last->id}", ['action' => 'verified'])->assertOk();
        Notification::assertSentToTimes($recipient, TermReportDueNotification::class, 1);
        Notification::assertSentTo($recipient, TermReportDueNotification::class, function ($n, $channels) use ($recipient) {
            $data = $n->toArray($recipient);

            return $channels === ['mail', 'database']
                && $data['type'] === 'term_report'
                && $data['message'] === "You've completed the 5 required hours for 1st Semester 2024-2025. Submit your end-of-term narrative report on the Hours page — your stipend can't be released without it.";
        });
        $this->assertNotNull($assignment->fresh()->report_due_hours_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'term_report_reminder', 'auditable_id' => $assignment->id]);

        // More hours later: no second reminder.
        $extra = $this->makeClosedLog($assignment, 1, 'pending_verification', daysAgo: 0);
        $this->putJson("/api/supervisor/verifications/{$extra->id}", ['action' => 'verified'])->assertOk();
        Notification::assertSentToTimes($recipient, TermReportDueNotification::class, 1);
    }

    public function test_no_reminder_once_the_report_is_in(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $supervisor, null, ['required_hours' => 2]);
        $this->submitTermReport($assignment);
        $log = $this->makeClosedLog($assignment, 2, 'pending_verification', daysAgo: 0);

        Sanctum::actingAs($supervisor);
        $this->putJson("/api/supervisor/verifications/{$log->id}", ['action' => 'verified'])->assertOk();

        Notification::assertNotSentTo($recipient, TermReportDueNotification::class);
        $this->assertNull($assignment->fresh()->report_due_hours_at);
    }

    public function test_lowering_the_required_hours_can_complete_the_term(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $supervisor, null, ['required_hours' => 10]);
        $this->makeClosedLog($assignment, 6);

        Sanctum::actingAs($supervisor);
        $this->putJson("/api/supervisor/students/{$recipient->id}/required-hours", ['required_hours' => 6])->assertOk();

        Notification::assertSentToTimes($recipient, TermReportDueNotification::class, 1);
    }

    public function test_the_end_of_the_term_reminds_current_placements_without_a_report(): void
    {
        $this->period(endedDaysAgo: 1);
        $supervisor = $this->makeUser('supervisor');
        $without = $this->makeUser('recipient');
        $withoutTerm = $this->makeAssignment($without, $supervisor, null, ['required_hours' => 10]);
        $this->makeClosedLog($withoutTerm, 4);
        $with = $this->makeUser('recipient');
        $withTerm = $this->makeAssignment($with, $supervisor, null, ['required_hours' => 10]);
        $this->submitTermReport($withTerm);

        $this->artisan('semester:close')->assertSuccessful();
        $this->artisan('semester:close')->assertSuccessful();

        Notification::assertSentToTimes($without, TermReportDueNotification::class, 1);
        Notification::assertSentTo($without, TermReportDueNotification::class, fn ($n) => $n->toArray($without)['message']
            === '1st Semester 2024-2025 has ended. Submit your end-of-term narrative report on the Hours page — your stipend and renewal need it.');
        Notification::assertNotSentTo($with, TermReportDueNotification::class);
        $this->assertNotNull($withoutTerm->fresh()->report_due_ended_at);
    }

    public function test_an_old_semester_is_recorded_without_reminders(): void
    {
        $this->period(endedDaysAgo: 40);
        $recipient = $this->makeUser('recipient');
        $this->makeAssignment($recipient, $this->makeUser('supervisor'), null, ['required_hours' => 10]);

        $this->artisan('semester:close')->assertSuccessful();

        Notification::assertNotSentTo($recipient, TermReportDueNotification::class);
    }
}
