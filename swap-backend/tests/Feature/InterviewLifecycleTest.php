<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Interview;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

class InterviewLifecycleTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    /** @return array{0: User, 1: Application} admin, application with a scheduled interview */
    private function makeScheduledInterview(): array
    {
        $admin = $this->makeUser('admin');
        $applicant = $this->makeUser('applicant');

        $application = Application::create([
            'user_id' => $applicant->id,
            'academic_year' => '2025-2026',
            'semester' => '1st Semester',
            'status' => 'under_review',
        ]);

        Sanctum::actingAs($admin);
        $this->postJson("/api/admin/applications/{$application->id}/interview", [
            // Times are sent with an explicit offset: the scheduling rules are
            // expressed in Asia/Manila, not in the app's UTC default.
            'scheduled_at' => self::manilaSlot(3, 10)->toIso8601String(),
            'mode' => 'in_person',
        ])->assertOk();

        return [$admin, $application->fresh()];
    }

    /**
     * A future weekday at `hour` o'clock Manila time, at least `minDays` away.
     * Skips forward over weekends so face-to-face slots stay legal.
     */
    private static function manilaSlot(int $minDays, int $hour): \Illuminate\Support\Carbon
    {
        $at = \Illuminate\Support\Carbon::now(\App\Support\InterviewWindow::TIMEZONE)
            ->addDays($minDays)
            ->setTime($hour, 0, 0, 0);

        while ($at->isWeekend()) {
            $at->addDay();
        }

        return $at;
    }

    public function test_reschedule_updates_time_and_logs_history(): void
    {
        [, $application] = $this->makeScheduledInterview();
        $originalAt = $application->interview->scheduled_at;
        $newAt = self::manilaSlot(7, 14);

        $res = $this->putJson("/api/admin/applications/{$application->id}/interview", [
            'scheduled_at' => $newAt->toIso8601String(),
            'mode' => 'online',
            'location' => 'Division of Student Affairs (DSA)',
            'meeting_link' => 'https://meet.example/dsa',
        ]);

        $res->assertOk();

        $interview = $application->fresh('interview')->interview;
        $this->assertSame(
            $newAt->utc()->format('Y-m-d H:i:s'),
            $interview->scheduled_at->utc()->format('Y-m-d H:i:s')
        );
        $this->assertSame('scheduled', $interview->status);

        // History: an audit entry records old + new time and the actor.
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'rescheduled',
            'auditable_type' => Interview::class,
            'auditable_id' => $interview->id,
        ]);

        $history = $res->json('data.interview.history');
        $this->assertCount(1, $history);
        $this->assertSame($originalAt->toISOString(), $history[0]['from']);
        $this->assertNotNull($history[0]['changed_by']);
    }

    public function test_no_show_can_be_set_by_admin_and_cleared_by_reschedule(): void
    {
        [, $application] = $this->makeScheduledInterview();

        $this->postJson("/api/admin/applications/{$application->id}/interview/no-show")
            ->assertOk()
            ->assertJsonPath('data.interview.status', 'no_show');

        // A second no-show on an already no-show interview is rejected.
        $this->postJson("/api/admin/applications/{$application->id}/interview/no-show")
            ->assertStatus(409);

        // Rescheduling puts the interview back into play.
        $this->putJson("/api/admin/applications/{$application->id}/interview", [
            'scheduled_at' => now()->addDays(5)->toDateTimeString(),
            'mode' => 'in_person',
        ])->assertOk()->assertJsonPath('data.interview.status', 'scheduled');
    }

    public function test_no_show_and_reschedule_are_denied_for_non_admin_roles(): void
    {
        [, $application] = $this->makeScheduledInterview();

        foreach (['supervisor', 'recipient', 'applicant'] as $role) {
            Sanctum::actingAs($this->makeUser($role));

            $this->postJson("/api/admin/applications/{$application->id}/interview/no-show")
                ->assertStatus(403);

            $this->putJson("/api/admin/applications/{$application->id}/interview", [
                'scheduled_at' => now()->addDays(5)->toDateTimeString(),
                'mode' => 'in_person',
            ])->assertStatus(403);
        }
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        [, $application] = $this->makeScheduledInterview();

        $this->app['auth']->forgetGuards();

        $this->postJson("/api/admin/applications/{$application->id}/interview/no-show", [], ['Authorization' => ''])
            ->assertStatus(401);
    }
}
