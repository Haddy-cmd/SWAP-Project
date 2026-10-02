<?php

namespace Tests\Feature;

use App\Models\Concern;
use App\Notifications\ConcernMessageNotification;
use App\Notifications\ConcernRepliedNotification;
use App\Notifications\ConcernSubmittedNotification;
use App\Services\ConcernService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Concerns sent from the SWAP Assistant (Ask the DSA) and the admin Concerns inbox. */
class ConcernTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_a_user_submits_a_concern_and_admins_are_told(): void
    {
        Notification::fake();
        $admin = $this->makeUser('admin');
        $student = $this->makeUser('recipient');
        Sanctum::actingAs($student);

        $this->postJson('/api/concerns', ['subject' => 'Hours', 'message' => 'short'])
            ->assertStatus(422)->assertJsonPath('errors.message.0', 'Please describe your concern in at least 10 characters.');

        $this->postJson('/api/concerns', ['subject' => 'Missing hours', 'message' => 'My Tuesday session is not showing.'])
            ->assertStatus(201)
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('message', 'Your concern has been submitted. The DSA Office will respond shortly.');

        Notification::assertSentTo($admin, ConcernSubmittedNotification::class);
        $this->assertDatabaseHas('audit_logs', ['action' => 'concern_submitted', 'user_id' => $student->id]);
    }

    public function test_admin_replies_and_the_student_is_notified(): void
    {
        Notification::fake();
        $student = $this->makeUser('applicant');
        $concern = Concern::create(['user_id' => $student->id, 'subject' => 'Interview', 'message' => 'Can I move my interview?']);
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);

        $this->getJson('/api/admin/concerns')
            ->assertOk()
            ->assertJsonPath('data.0.subject', 'Interview')
            ->assertJsonPath('data.0.user.email', $student->email)
            ->assertJsonPath('meta.counts.open', 1);

        // Resolving needs a reply.
        $this->putJson("/api/admin/concerns/{$concern->id}", ['status' => 'resolved'])
            ->assertStatus(422)->assertJsonPath('errors.response.0', 'Write a reply before marking this concern resolved.');

        // Triage without a reply notifies nobody.
        $this->putJson("/api/admin/concerns/{$concern->id}", ['status' => 'in_progress'])->assertOk();
        Notification::assertNothingSentTo($student);

        $this->putJson("/api/admin/concerns/{$concern->id}", ['status' => 'resolved', 'response' => 'Yes, it is moved to Friday 9 AM.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'resolved')
            ->assertJsonPath('data.responded_by', $admin->name)
            ->assertJsonPath('message', 'Concern resolved. The student has been notified.');

        Notification::assertSentTo($student, ConcernRepliedNotification::class);
        $this->assertDatabaseHas('audit_logs', ['action' => 'concern_updated', 'user_id' => $admin->id]);

        // Already answered: reopening and resolving again needs no new reply, and sends nothing new.
        $this->putJson("/api/admin/concerns/{$concern->id}", ['status' => 'open'])->assertOk();
        $this->putJson("/api/admin/concerns/{$concern->id}", ['status' => 'resolved'])->assertOk();
        Notification::assertSentToTimes($student, ConcernRepliedNotification::class, 1);
        $this->getJson('/api/admin/concerns?status=resolved')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_a_user_sees_only_their_own_concerns(): void
    {
        $mine = $this->makeUser('supervisor');
        $other = $this->makeUser('recipient');
        Concern::create(['user_id' => $mine->id, 'subject' => 'Mine', 'message' => 'A concern of my own.', 'response' => 'Answered.']);
        Concern::create(['user_id' => $other->id, 'subject' => 'Theirs', 'message' => 'Somebody else.']);

        Sanctum::actingAs($mine);
        $this->getJson('/api/concerns')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.subject', 'Mine')
            ->assertJsonPath('data.0.response', 'Answered.')
            ->assertJsonMissingPath('data.0.user');
    }

    public function test_a_concern_is_a_continuous_thread(): void
    {
        Notification::fake();
        $admin = $this->makeUser('admin');
        $student = $this->makeUser('recipient');
        Sanctum::actingAs($student);

        // Opening the concern starts the thread with one message.
        $id = $this->postJson('/api/concerns', ['subject' => 'Missing hours', 'message' => 'My Tuesday session is not showing.'])
            ->assertStatus(201)
            ->assertJsonCount(1, 'data.messages')
            ->assertJsonPath('data.messages.0.from_staff', false)
            ->assertJsonPath('data.messages.0.body', 'My Tuesday session is not showing.')
            ->json('data.id');

        // A follow-up needs no subject and joins the same thread; admins are told.
        $this->postJson("/api/concerns/{$id}/messages", ['body' => 'It is still missing today.'])
            ->assertStatus(201)
            ->assertJsonPath('message', 'Reply sent.')
            ->assertJsonCount(2, 'data.messages')
            ->assertJsonPath('data.messages.1.body', 'It is still missing today.')
            ->assertJsonPath('data.messages.1.from_staff', false);
        Notification::assertSentTo($admin, ConcernMessageNotification::class);
        $this->assertDatabaseHas('audit_logs', ['action' => 'concern_message_added', 'user_id' => $student->id]);

        // An empty reply is rejected.
        $this->postJson("/api/concerns/{$id}/messages", ['body' => ' '])
            ->assertStatus(422)->assertJsonPath('errors.body.0', 'Type your reply.');

        // The DSA reply joins the thread too, and the student's list shows the whole conversation.
        Sanctum::actingAs($admin);
        $this->putJson("/api/admin/concerns/{$id}", ['status' => 'in_progress', 'response' => 'Looking into it now.'])
            ->assertOk()
            ->assertJsonCount(3, 'data.messages')
            ->assertJsonPath('data.messages.2.from_staff', true)
            ->assertJsonPath('data.messages.2.author', $admin->name);

        Sanctum::actingAs($student);
        $this->getJson('/api/concerns')->assertOk()
            ->assertJsonPath('data.0.messages.0.from_staff', false)
            ->assertJsonPath('data.0.messages.2.from_staff', true)
            ->assertJsonCount(3, 'data.0.messages');
    }

    public function test_follow_ups_stop_once_the_concern_is_resolved(): void
    {
        $student = $this->makeUser('recipient');
        $concern = Concern::create(['user_id' => $student->id, 'subject' => 'Done', 'message' => 'Please help.', 'status' => 'resolved']);
        Sanctum::actingAs($student);

        $this->postJson("/api/concerns/{$concern->id}/messages", ['body' => 'One more thing.'])
            ->assertStatus(422)->assertJsonPath('message', ConcernService::MSG_RESOLVED);
    }

    public function test_a_user_cannot_reply_on_someone_elses_concern(): void
    {
        $owner = $this->makeUser('recipient');
        $concern = Concern::create(['user_id' => $owner->id, 'subject' => 'Theirs', 'message' => 'Not yours.']);

        Sanctum::actingAs($this->makeUser('recipient'));
        $this->postJson("/api/concerns/{$concern->id}/messages", ['body' => 'Sneaking in.'])
            ->assertStatus(404)->assertJsonPath('message', 'Concern not found.');
        $this->assertDatabaseMissing('concern_messages', ['concern_id' => $concern->id]);
    }

    public function test_non_admins_cannot_use_the_inbox(): void
    {
        $concern = Concern::create(['user_id' => $this->makeUser('recipient')->id, 'subject' => 'X', 'message' => 'Something wrong here.']);

        foreach (['applicant', 'recipient', 'supervisor'] as $role) {
            Sanctum::actingAs($this->makeUser($role));
            $this->getJson('/api/admin/concerns')->assertStatus(403);
            $this->putJson("/api/admin/concerns/{$concern->id}", ['status' => 'resolved', 'response' => 'Nope.'])->assertStatus(403);
        }
    }
}
