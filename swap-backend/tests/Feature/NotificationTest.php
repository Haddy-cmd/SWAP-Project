<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function makeNotification(User $user, array $attrs = []): Notification
    {
        return Notification::create(array_merge([
            'id' => (string) Str::uuid(),
            'type' => 'App\\Notifications\\Generic',
            'notifiable_type' => User::class,
            'notifiable_id' => $user->id,
            'data' => ['title' => 'Test', 'message' => 'Hello'],
            'read_at' => null,
        ], $attrs));
    }

    public function test_user_fetches_their_notifications(): void
    {
        $user = $this->makeUser('recipient');
        $this->makeNotification($user);
        $this->makeNotification($user);

        Sanctum::actingAs($user);
        $res = $this->getJson('/api/notifications')->assertStatus(200);

        $this->assertEquals(2, $res->json('meta.total'));
        $this->assertEquals(2, $res->json('meta.unread_count'));
    }

    public function test_mark_one_as_read(): void
    {
        $user = $this->makeUser('recipient');
        $n = $this->makeNotification($user);

        Sanctum::actingAs($user);
        $this->putJson("/api/notifications/{$n->id}/read")->assertStatus(200);

        $this->assertNotNull($n->fresh()->read_at);
    }

    public function test_mark_all_as_read(): void
    {
        $user = $this->makeUser('recipient');
        $this->makeNotification($user);
        $this->makeNotification($user);

        Sanctum::actingAs($user);
        $this->putJson('/api/notifications/read-all')->assertStatus(200);

        $res = $this->getJson('/api/notifications')->assertStatus(200);
        $this->assertEquals(0, $res->json('meta.unread_count'));
    }

    public function test_clock_out_notifies_supervisor_for_verification(): void
    {
        $recipient = $this->makeUser('recipient');
        $supervisor = $this->makeUser('supervisor');
        $office = $this->makeGeofencedOffice();
        $assignment = $this->makeAssignment($recipient, $supervisor, $office);
        $log = $this->makeOpenLog($assignment, $recipient, now()->subHours(2));
        $this->addNarrative($log);

        Sanctum::actingAs($recipient);
        $this->postJson('/api/recipient/attendance/time-out', [
            'log_id' => $log->id, 'qr_token' => $this->qrForOffice($office),
        ])->assertStatus(200);

        $note = Notification::where('notifiable_id', $supervisor->id)
            ->where('notifiable_type', User::class)
            ->first();

        $this->assertNotNull($note, 'Supervisor should receive a verification notification.');
        $this->assertSame('verification', $note->data['type']);
    }

    public function test_application_submission_notifies_admins(): void
    {
        $admin = $this->makeUser('admin');
        $applicant = $this->makeUser('applicant');

        Sanctum::actingAs($applicant);
        $this->postJson('/api/applicant/applications', [
            'academic_year' => '2025-2026', 'semester' => '1st Semester',
        ])->assertStatus(201);

        $note = Notification::where('notifiable_id', $admin->id)
            ->where('notifiable_type', User::class)
            ->first();

        $this->assertNotNull($note, 'Admin should be notified of a new application.');
        $this->assertSame('application', $note->data['type']);
    }
}
