<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\PaceReminderNotification;
use App\Services\PaceReminderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Supervisor dashboard v2: the Falling behind bell, and verified hours this week. */
class PaceReminderTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    /** Halfway through a 240h term with only 10h verified: behind by 110h. */
    private function behind(User $supervisor): Assignment
    {
        $assignment = $this->makeAssignment($this->makeUser('recipient'), $supervisor, null, [
            'start_date' => Carbon::today()->subDays(60)->toDateString(),
            'end_date' => Carbon::today()->addDays(60)->toDateString(),
        ]);
        $this->makeClosedLog($assignment, 10);

        return $assignment;
    }

    public function test_a_behind_student_is_reminded_once_a_day(): void
    {
        Notification::fake();
        $supervisor = $this->makeUser('supervisor');
        $assignment = $this->behind($supervisor);
        $student = $assignment->user;
        Sanctum::actingAs($supervisor);

        $this->postJson("/api/supervisor/students/{$student->id}/remind-pace")->assertOk()
            ->assertJsonPath('message', "Reminder sent to {$student->name}.");
        Notification::assertSentTo($student, PaceReminderNotification::class,
            // The gap moves a little with the time of day (the term's elapsed fraction): ~110h.
            fn ($n) => (bool) preg_match("/^You're 1(0[89]|1[0-2])(\\.\\d)?h behind for 1st Semester 2024-2025 — 10h of 240h verified\\./u", $n->toArray($student)['message']));

        $log = AuditLog::where('action', PaceReminderService::ACTION)->firstOrFail();
        $this->assertSame($supervisor->id, $log->user_id);
        $this->assertSame($student->id, $log->subject_user_id);
        $this->assertEqualsWithDelta(110, $log->new_values['deficit_hours'], 1.5); // moves with the time of day

        $this->postJson("/api/supervisor/students/{$student->id}/remind-pace")->assertStatus(422)
            ->assertJsonPath('errors.student.0', PaceReminderService::MSG_TODAY);
        Notification::assertSentToTimes($student, PaceReminderNotification::class, 1);

        $row = collect($this->getJson('/api/supervisor/students')->assertOk()->json('data'))->firstWhere('user_id', $student->id);
        $this->assertTrue($row['pace_reminded_today']);
    }

    public function test_only_behind_students_of_your_own_can_be_reminded(): void
    {
        Notification::fake();
        $supervisor = $this->makeUser('supervisor');
        $onTrack = $this->makeAssignment($this->makeUser('recipient'), $supervisor);
        $someoneElses = $this->behind($this->makeUser('supervisor'));
        Sanctum::actingAs($supervisor);

        $this->postJson("/api/supervisor/students/{$onTrack->user_id}/remind-pace")->assertStatus(422)
            ->assertJsonPath('errors.student.0', "{$onTrack->user->name} isn't behind schedule.");
        $this->postJson("/api/supervisor/students/{$someoneElses->user_id}/remind-pace")->assertNotFound();
        Notification::assertNothingSent();
        $this->assertSame(0, AuditLog::where('action', PaceReminderService::ACTION)->count());
    }

    public function test_roster_rows_carry_bonus_hours_and_promissory_flags(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $a = $this->makeAssignment($this->makeUser('recipient'), $supervisor);
        $this->makeClosedLog($a, 2)->forceFill(['is_manual' => true])->save();                          // verified bonus
        $this->makeClosedLog($a, 1.5, 'pending_verification')->forceFill(['is_manual' => true])->save(); // not counted
        $this->makeClosedLog($a, 5);
        \App\Models\PromissoryNote::create(['assignment_id' => $a->id, 'user_id' => $a->user_id, 'academic_year' => $a->academic_year,
            'semester' => $a->semester, 'verified_hours_snapshot' => 4, 'lacking_hours' => 6, 'deficient_hours' => 6,
            'status' => 'pending', 'file_path' => 'p.pdf', 'file_name' => 'p.pdf', 'mime_type' => 'application/pdf', 'file_size' => 1]);
        Sanctum::actingAs($supervisor);

        $this->getJson('/api/supervisor/students')->assertOk()
            ->assertJsonPath('data.0.bonus_hours', 2)
            ->assertJsonPath('data.0.has_pending_promissory', true)
            ->assertJsonPath('data.0.has_approved_promissory', false);
    }

    public function test_verified_hours_this_week_counts_only_this_weeks_verifications(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $assignment = $this->makeAssignment($this->makeUser('recipient'), $supervisor);
        $this->makeClosedLog($assignment, 3)->forceFill(['verified_at' => now()])->save();
        $this->makeClosedLog($assignment, 2.5)->forceFill(['verified_at' => now()])->save();
        $this->makeClosedLog($assignment, 4)->forceFill(['verified_at' => now()->subWeeks(2)])->save();
        $this->makeClosedLog($assignment, 6, 'pending_verification');
        Sanctum::actingAs($supervisor);

        $this->getJson('/api/supervisor/students')->assertOk()
            ->assertJsonPath('meta.verified_hours_this_week', 5.5)
            ->assertJsonPath('meta.verified_this_week', 2);
    }
}
