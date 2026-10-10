<?php

namespace Tests\Feature;

use App\Mail\AnnouncementMail;
use App\Models\User;
use App\Notifications\SignatureRequiredNotification;
use App\Support\TestTools;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * Admin → System Testing → email switch: off = the picked accounts get bell notifications
 * but no email; everyone else, and account emails, are untouched.
 */
class TestingEmailSwitchTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    /** [user id, channel] for every notification actually delivered. */
    private array $sent = [];

    protected function setUp(): void
    {
        parent::setUp();
        Event::listen(NotificationSent::class, fn (NotificationSent $e) => $this->sent[] = [$e->notifiable->id, $e->channel]);
    }

    private function picked(): User
    {
        $user = $this->makeUser('recipient');
        $user->forceFill(['testing_added_at' => now(), 'testing_email_muted' => true])->save();

        return $user;
    }

    private function switchEmail(User $user, bool $muted)
    {
        Sanctum::actingAs($this->makeUser('admin'));

        return $this->putJson("/api/admin/testing/accounts/{$user->id}/email", ['muted' => $muted]);
    }

    public function test_picked_accounts_start_with_emails_off_and_each_has_its_switch(): void
    {
        $picked = $this->makeUser('recipient');
        TestTools::setEnabled(true);
        Sanctum::actingAs($admin = $this->makeUser('admin'));
        $this->postJson("/api/admin/testing/accounts/{$picked->id}")->assertOk();
        $this->assertTrue($picked->fresh()->testing_email_muted);
        $row = fn () => collect($this->getJson('/api/admin/testing')->json('data.accounts'))->firstWhere('id', $picked->id);
        $this->assertTrue($row()['email_muted']);

        $this->switchEmail($picked, false)->assertOk()
            ->assertJsonPath('message', "Emails to {$picked->name} are on.");
        $this->assertFalse($row()['email_muted']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'testing_email_on', 'auditable_id' => $picked->id]);

        $this->switchEmail($picked, true)->assertOk()
            ->assertJsonPath('message', "Emails to {$picked->name} are off. They still get bell notifications; verification and password-reset emails still go out.");
        $this->assertDatabaseHas('audit_logs', ['action' => 'testing_email_off', 'auditable_id' => $picked->id]);

        $this->putJson("/api/admin/testing/accounts/{$picked->id}/email", [])->assertStatus(422);
        $this->putJson('/api/admin/testing/accounts/'.$this->makeUser('recipient')->id.'/email', ['muted' => false])->assertNotFound();
        Sanctum::actingAs($this->makeUser('supervisor'));
        $this->putJson("/api/admin/testing/accounts/{$picked->id}/email", ['muted' => true])->assertForbidden();
    }

    public function test_muted_picked_accounts_get_the_bell_but_no_email(): void
    {
        $picked = $this->picked();
        $real = $this->makeUser('recipient');

        $picked->notify(new SignatureRequiredNotification());
        $real->notify(new SignatureRequiredNotification());

        $this->assertContains([$picked->id, 'database'], $this->sent);
        $this->assertNotContains([$picked->id, 'mail'], $this->sent);
        $this->assertContains([$real->id, 'mail'], $this->sent);

        // Account emails always go out.
        $picked->sendPasswordResetNotification('token');
        $this->assertContains([$picked->id, 'mail'], $this->sent);
    }

    public function test_switching_an_account_on_emails_it_again(): void
    {
        $picked = $this->picked();
        $this->switchEmail($picked, false)->assertOk();

        $picked->fresh()->notify(new SignatureRequiredNotification());

        $this->assertContains([$picked->id, 'mail'], $this->sent);
    }

    public function test_announcements_skip_the_email_to_muted_test_accounts(): void
    {
        Mail::fake();
        $picked = $this->picked();
        $real = $this->makeUser('recipient');
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/announcements', ['title' => 'Schedule', 'message' => 'Office hours change on Monday.'])
            ->assertCreated()
            ->assertJsonPath('message', 'Announcement sent to 2 active recipient(s) in the portal and by email (1 test account(s) in the portal only: System Testing emails are off).');

        Mail::assertSent(AnnouncementMail::class, fn (AnnouncementMail $m) => $m->hasBcc($real->email) && !$m->hasBcc($picked->email));
        $this->assertDatabaseHas('notifications', ['notifiable_id' => $picked->id, 'type' => \App\Notifications\AnnouncementNotification::class]);
    }
}
