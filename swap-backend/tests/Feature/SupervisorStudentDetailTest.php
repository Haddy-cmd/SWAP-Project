<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\StipendHistory;
use App\Notifications\TermReportDueNotification;
use App\Services\TermReportReminderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Supervisor → student page v2: "Remind to submit" and the summary's new fields. */
class SupervisorStudentDetailTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_remind_to_submit_once_a_day(): void
    {
        Notification::fake();
        $supervisor = $this->makeUser('supervisor', ['name' => 'Prof. Sittie Hadja']);
        $a = $this->makeAssignment($this->makeUser('recipient'), $supervisor);
        $student = $a->user;
        Sanctum::actingAs($supervisor);

        $this->postJson("/api/supervisor/students/{$student->id}/remind-report")->assertOk()
            ->assertJsonPath('message', "Reminder sent to {$student->name}.");
        Notification::assertSentTo($student, TermReportDueNotification::class,
            fn ($n) => str_starts_with($n->toArray($student)['message'], 'Prof. Sittie Hadja reminds you to submit your end-of-term report for 1st Semester 2024-2025'));
        $log = AuditLog::where('action', 'term_report_reminder')->firstOrFail();
        $this->assertSame($supervisor->id, $log->user_id);
        $this->assertSame(TermReportReminderService::KIND_SUPERVISOR, $log->new_values['kind']);

        $this->getJson("/api/supervisor/students/{$student->id}/summary")->assertJsonPath('report_reminded_today', true);
        $this->postJson("/api/supervisor/students/{$student->id}/remind-report")->assertStatus(422)
            ->assertJsonPath('errors.report.0', TermReportReminderService::MSG_TODAY);
        Notification::assertSentToTimes($student, TermReportDueNotification::class, 1);
    }

    public function test_no_reminder_once_submitted_when_locked_or_for_someone_elses_student(): void
    {
        Notification::fake();
        $supervisor = $this->makeUser('supervisor');
        $submitted = $this->makeAssignment($this->makeUser('recipient'), $supervisor);
        $this->submitTermReport($submitted);
        $locked = $this->makeAssignment($this->makeUser('recipient'), $supervisor);
        StipendHistory::create(['user_id' => $locked->user_id, 'amount' => 5000, 'academic_year' => $locked->academic_year,
            'semester' => $locked->semester, 'status' => StipendHistory::STATUS_RELEASED]);
        $other = $this->makeAssignment($this->makeUser('recipient'), $this->makeUser('supervisor'));
        Sanctum::actingAs($supervisor);

        $this->postJson("/api/supervisor/students/{$submitted->user_id}/remind-report")->assertStatus(422)
            ->assertJsonPath('errors.report.0', TermReportReminderService::MSG_SUBMITTED);
        $this->postJson("/api/supervisor/students/{$locked->user_id}/remind-report")->assertStatus(422)
            ->assertJsonPath('errors.report.0', TermReportReminderService::MSG_LOCKED);
        $this->getJson("/api/supervisor/students/{$locked->user_id}/summary")->assertJsonPath('report_locked', true);
        $this->postJson("/api/supervisor/students/{$other->user_id}/remind-report")->assertNotFound();
        Notification::assertNothingSent();
    }

    public function test_summary_lists_this_terms_bonuses_and_start_date(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $a = $this->makeAssignment($this->makeUser('recipient'), $supervisor, null, ['start_date' => '2026-08-04']);
        $this->makeClosedLog($a, 2, 'verified', 3)->forceFill(['is_manual' => true, 'manual_reason' => 'Enrollment week'])->save();
        $this->makeClosedLog($a, 1, 'rejected', 2)->forceFill(['is_manual' => true, 'manual_reason' => 'Not counted'])->save();
        $this->makeClosedLog($a, 4);
        Sanctum::actingAs($supervisor);

        $this->getJson("/api/supervisor/students/{$a->user_id}/summary")->assertOk()
            ->assertJsonPath('student.start_date', '2026-08-04')
            ->assertJsonCount(1, 'bonuses')
            ->assertJsonPath('bonuses.0.hours', 2)
            ->assertJsonPath('bonuses.0.reason', 'Enrollment week')
            ->assertJsonPath('report_reminded_today', false)
            ->assertJsonPath('report_locked', false);
    }
}
