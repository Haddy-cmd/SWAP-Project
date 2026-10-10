<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\VerificationReminderNotification;
use App\Services\SupervisorReminderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Analytics → Supervisors → "Remind busy supervisors". */
class SupervisorReminderTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private const TERM = ['academic_year' => '2024-2025', 'semester' => '1st Semester'];

    /** A supervisor whose recipient has `$logs` pending logs, the oldest `$daysAgo` days old. */
    private function supervisorWithPending(int $logs, int $daysAgo): User
    {
        $supervisor = $this->makeUser('supervisor');
        $assignment = $this->makeAssignment($this->makeUser('recipient'), $supervisor);
        for ($i = 0; $i < $logs; $i++) {
            $this->makeClosedLog($assignment, 1, 'pending_verification', $i === 0 ? $daysAgo : 0);
        }

        return $supervisor;
    }

    public function test_only_busy_supervisors_are_reminded_once_a_day(): void
    {
        Notification::fake();
        $many = $this->supervisorWithPending(SupervisorReminderService::BUSY_PENDING, 0);
        $old = $this->supervisorWithPending(1, SupervisorReminderService::BUSY_DAYS + 1);
        $fine = $this->supervisorWithPending(2, 1);
        $admin = $this->makeUser('admin');

        Sanctum::actingAs($admin);
        $this->postJson('/api/admin/analytics/remind-supervisors', self::TERM)->assertOk()
            ->assertJsonPath('data.reminded', 2)->assertJsonPath('data.already_today', 0);

        Notification::assertSentTo($many, VerificationReminderNotification::class,
            fn ($n) => str_contains($n->toArray($many)['message'], '10 hour logs waiting for verification for 1st Semester 2024-2025'));
        Notification::assertSentTo($old, VerificationReminderNotification::class);
        Notification::assertNotSentTo($fine, VerificationReminderNotification::class);
        $this->assertSame(2, AuditLog::where('action', 'verification_reminder_sent')->where('user_id', $admin->id)->count());
        $this->assertSame($many->id, AuditLog::where('action', 'verification_reminder_sent')->where('auditable_id', $many->id)->value('subject_user_id'));

        // Again the same day: nobody is reminded twice.
        $this->postJson('/api/admin/analytics/remind-supervisors', self::TERM)->assertOk()
            ->assertJsonPath('data.reminded', 0)->assertJsonPath('data.already_today', 2);
        Notification::assertSentToTimes($many, VerificationReminderNotification::class, 1);
    }

    public function test_the_term_is_required_and_only_admins_may_remind(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/analytics/remind-supervisors', [])->assertStatus(422);

        Sanctum::actingAs($this->makeUser('supervisor'));
        $this->postJson('/api/admin/analytics/remind-supervisors', self::TERM)->assertStatus(403);
    }
}
