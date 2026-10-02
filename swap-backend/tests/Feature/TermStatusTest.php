<?php

namespace Tests\Feature;

use App\Console\Commands\CloseSemesters;
use App\Models\Assignment;
use App\Models\PromissoryNote;
use App\Models\SemesterPeriod;
use App\Models\User;
use App\Notifications\TermStatusNotification;
use App\Services\TermStatusService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** The persisted end-of-term verdict: semester:close, re-qualifying after makeup, manual marks. */
class TermStatusTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
    }

    private function period(int $endedDaysAgo, string $semester = '1st Semester'): SemesterPeriod
    {
        $today = Carbon::now('Asia/Manila');

        return SemesterPeriod::create([
            'academic_year' => '2024-2025',
            'semester' => $semester,
            'start_date' => $today->copy()->subDays($endedDaysAgo + 120)->toDateString(),
            'end_date' => $today->copy()->subDays($endedDaysAgo)->toDateString(),
        ]);
    }

    /** @return array{0: User, 1: Assignment, 2: User} recipient, assignment, supervisor */
    private function term(float $verified, int $required = 10, array $attrs = []): array
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $supervisor, null, ['required_hours' => $required] + $attrs);
        if ($verified > 0) {
            $this->makeClosedLog($assignment, $verified);
        }

        return [$recipient, $assignment, $supervisor];
    }

    public function test_close_records_qualified_and_deficient_and_is_idempotent(): void
    {
        $period = $this->period(endedDaysAgo: 1);
        [$short, $shortTerm] = $this->term(verified: 4);
        [$met, $metTerm] = $this->term(verified: 10);
        // A term the DSA never set up is left alone.
        [, $otherTerm] = $this->term(verified: 1, attrs: ['semester' => 'Summer', 'end_date' => now()->subMonth()->toDateString()]);

        $this->artisan('semester:close')->assertSuccessful();

        $shortTerm->refresh();
        $this->assertSame(Assignment::TERM_DEFICIENT, $shortTerm->term_status);
        $this->assertEquals(6.0, (float) $shortTerm->deficient_hours);
        $this->assertNull($shortTerm->term_status_by);
        $this->assertNotNull($shortTerm->term_status_at);
        $this->assertSame('deficient', $shortTerm->termBadge());

        $metTerm->refresh();
        $this->assertSame(Assignment::TERM_QUALIFIED, $metTerm->term_status);
        $this->assertNull($metTerm->deficient_hours);

        $this->assertNull($otherTerm->fresh()->term_status);
        $this->assertNotNull($period->fresh()->closed_at);

        Notification::assertSentTo($short, TermStatusNotification::class, function ($n) use ($short) {
            return $n->toArray($short)['message'] === 'You were 6 hours short for 1st Semester 2024-2025. Submit a promissory note on the Stipend page.';
        });
        Notification::assertNotSentTo($met, TermStatusNotification::class);

        // Running again changes nothing and notifies no one twice.
        $this->artisan('semester:close')->assertSuccessful();
        Notification::assertSentToTimes($short, TermStatusNotification::class, 1);
        $this->assertEquals(6.0, (float) $shortTerm->fresh()->deficient_hours);
    }

    public function test_a_term_still_running_is_not_closed(): void
    {
        $this->period(endedDaysAgo: 0); // ends today
        [, $assignment] = $this->term(verified: 2);

        $this->artisan('semester:close')->assertSuccessful();

        $this->assertNull($assignment->fresh()->term_status);
    }

    public function test_dry_run_saves_nothing(): void
    {
        $period = $this->period(endedDaysAgo: 1);
        [$recipient, $assignment] = $this->term(verified: 4);

        $this->artisan('semester:close', ['--dry-run' => true])
            ->expectsOutputToContain('[dry run] 0 qualified, 1 deficient')
            ->assertSuccessful();

        $this->assertNull($assignment->fresh()->term_status);
        $this->assertNull($period->fresh()->closed_at);
        Notification::assertNothingSent();
    }

    public function test_old_semesters_and_rolled_over_terms_are_recorded_quietly(): void
    {
        $this->period(endedDaysAgo: CloseSemesters::NOTIFY_WITHIN_DAYS + 30);
        [$old, $oldTerm] = $this->term(verified: 4);

        $this->period(endedDaysAgo: 1, semester: '2nd Semester');
        [$moved, $movedTerm] = $this->term(verified: 4, attrs: ['semester' => '2nd Semester', 'status' => 'completed']);

        $this->artisan('semester:close')->assertSuccessful();

        $this->assertSame(Assignment::TERM_DEFICIENT, $oldTerm->fresh()->term_status);
        $this->assertSame(Assignment::TERM_DEFICIENT, $movedTerm->fresh()->term_status);
        Notification::assertNotSentTo($old, TermStatusNotification::class);
        Notification::assertNotSentTo($moved, TermStatusNotification::class);
    }

    public function test_a_verified_makeup_requalifies_the_term(): void
    {
        $this->period(endedDaysAgo: 1);
        [$recipient, $assignment, $supervisor] = $this->term(verified: 7);
        $this->artisan('semester:close');
        $this->assertSame(Assignment::TERM_DEFICIENT, $assignment->fresh()->term_status);

        // Not enough yet: still deficient.
        $partial = $this->makeClosedLog($assignment, 1, 'pending_verification', daysAgo: 0);
        Sanctum::actingAs($supervisor);
        $this->putJson("/api/supervisor/verifications/{$partial->id}", ['action' => 'verified'])->assertOk();
        $this->assertSame(Assignment::TERM_DEFICIENT, $assignment->fresh()->term_status);

        // The makeup completes the hours: qualified at once, the shortfall kept as history.
        $makeup = $this->makeClosedLog($assignment, 2, 'pending_verification', daysAgo: 0);
        $this->putJson("/api/supervisor/verifications/{$makeup->id}", ['action' => 'verified'])->assertOk();

        $assignment->refresh();
        $this->assertSame(Assignment::TERM_QUALIFIED, $assignment->term_status);
        $this->assertEquals(3.0, (float) $assignment->deficient_hours);
        Notification::assertSentTo($recipient, TermStatusNotification::class, fn ($n) => $n->toArray($recipient)['title'] === 'Semester service: Qualified');
    }

    public function test_supervisor_marks_a_current_term_deficient(): void
    {
        [$recipient, $assignment, $supervisor] = $this->term(verified: 2);
        $url = "/api/supervisor/students/{$recipient->id}/mark-deficient";
        $reason = 'Stopped reporting to the office after midterms.';

        // Another office's supervisor can't.
        Sanctum::actingAs($this->makeUser('supervisor'));
        $this->postJson($url, ['reason' => $reason])->assertStatus(404);

        Sanctum::actingAs($supervisor);
        $this->postJson($url, ['reason' => 'short'])->assertStatus(422)
            ->assertJsonPath('errors.reason.0', 'The reason must be at least 10 characters.');

        $this->postJson($url, ['reason' => $reason])->assertOk()
            ->assertJsonPath('term.badge', 'deficient')
            ->assertJsonPath('term.deficient_hours', 8)
            ->assertJsonPath('term.marked_by_supervisor', true);

        $assignment->refresh();
        $this->assertSame(Assignment::TERM_DEFICIENT, $assignment->term_status);
        $this->assertSame($supervisor->id, $assignment->term_status_by);
        $this->assertSame($reason, $assignment->term_status_reason);
        $this->assertDatabaseHas('audit_logs', ['action' => 'term_marked_deficient', 'auditable_id' => $assignment->id, 'user_id' => $supervisor->id]);
        Notification::assertSentTo($recipient, TermStatusNotification::class, fn ($n) => str_contains($n->toArray($recipient)['message'], "Reason: {$reason}"));

        $this->postJson($url, ['reason' => $reason])->assertStatus(422)
            ->assertJsonPath('message', TermStatusService::MSG_ALREADY_DEFICIENT);

        // The student page shows it.
        $this->getJson("/api/supervisor/students/{$recipient->id}/summary")->assertOk()
            ->assertJsonPath('term.badge', 'deficient')
            ->assertJsonPath('term.reason', $reason);
    }

    public function test_a_student_who_met_the_hours_cannot_be_marked_deficient(): void
    {
        [$recipient, , $supervisor] = $this->term(verified: 10);
        Sanctum::actingAs($supervisor);

        $this->postJson("/api/supervisor/students/{$recipient->id}/mark-deficient", ['reason' => 'Attitude problems this term.'])
            ->assertStatus(422)->assertJsonPath('message', TermStatusService::MSG_NOT_SHORT);
    }

    public function test_a_mark_made_during_the_term_is_remeasured_when_it_ends(): void
    {
        $this->period(endedDaysAgo: 1);
        [$recipient, $assignment, $supervisor] = $this->term(verified: 2);
        Sanctum::actingAs($supervisor);
        $this->postJson("/api/supervisor/students/{$recipient->id}/mark-deficient", ['reason' => 'Missed most duty days in October.'])->assertOk();
        // The mark was made during the term…
        $assignment->update(['term_status_at' => now()->subDays(5)]);
        // …and the student rendered more before it ended.
        $this->makeClosedLog($assignment, 3);

        $this->artisan('semester:close')->assertSuccessful();

        $assignment->refresh();
        $this->assertSame(Assignment::TERM_DEFICIENT, $assignment->term_status);
        $this->assertEquals(5.0, (float) $assignment->deficient_hours);
        $this->assertSame($supervisor->id, $assignment->term_status_by);
    }

    public function test_badges_follow_promissory_notes_and_admin_can_filter(): void
    {
        $this->period(endedDaysAgo: 1);
        [$recipient, $assignment, $supervisor] = $this->term(verified: 4);
        [, $qualified] = $this->term(verified: 10);
        $this->artisan('semester:close');

        $note = PromissoryNote::create([
            'user_id' => $recipient->id, 'assignment_id' => $assignment->id, 'reason' => 'Exams.',
            'academic_year' => '2024-2025', 'semester' => '1st Semester',
            'file_path' => 'promissory/x.pdf', 'file_name' => 'x.pdf', 'mime_type' => 'application/pdf', 'file_size' => 100,
            'verified_hours_snapshot' => 4, 'lacking_hours' => 6,
            'status' => PromissoryNote::STATUS_PENDING,
        ]);
        $this->assertSame('promissory_pending', $assignment->fresh()->termBadge());
        $note->update(['status' => PromissoryNote::STATUS_APPROVED]);
        $this->assertSame('promissory_approved', $assignment->fresh()->termBadge());

        Sanctum::actingAs($this->makeUser('admin'));
        $this->getJson('/api/admin/assignments?term=deficient')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $assignment->id)
            ->assertJsonPath('data.0.term_badge', 'promissory_approved')
            ->assertJsonPath('data.0.deficient_hours', 6);
        $this->getJson('/api/admin/assignments?term=qualified')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $qualified->id);
    }
}
