<?php

namespace Tests\Feature;

use App\Mail\AnnouncementMail;
use App\Models\Announcement;
use App\Notifications\AnnouncementNotification;
use App\Services\AnnouncementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin → Announcements: every active recipient gets it in the portal and by email. */
class AnnouncementTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Stipend release schedule',
            'message' => "Claim stubs for the 1st Semester are ready.\nBring your student ID.\n\nThe Banking Office is open 8 AM to 3 PM.",
        ], $overrides);
    }

    public function test_it_reaches_every_active_recipient_and_no_one_else(): void
    {
        Notification::fake();
        Mail::fake();
        $active = [$this->makeUser('recipient'), $this->makeUser('recipient')];
        $inactive = $this->makeUser('recipient', ['is_active' => false]);
        $applicant = $this->makeUser('applicant');
        $supervisor = $this->makeUser('supervisor');
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);

        $this->postJson('/api/admin/announcements', $this->payload())
            ->assertStatus(201)
            ->assertJsonPath('data.recipient_count', 2)
            ->assertJsonPath('data.emailed_count', 2)
            ->assertJsonPath('message', 'Announcement sent to 2 active recipient(s) in the portal and by email.');

        Notification::assertSentTo($active, AnnouncementNotification::class);
        Notification::assertNotSentTo([$inactive, $applicant, $supervisor, $admin], AnnouncementNotification::class);

        // One email, recipients in Bcc (they never see each other's addresses).
        Mail::assertSent(AnnouncementMail::class, 1);
        Mail::assertSent(AnnouncementMail::class, fn (AnnouncementMail $mail) => $mail->hasBcc($active[0]->email)
            && $mail->hasBcc($active[1]->email)
            && !$mail->hasBcc($inactive->email)
            && $mail->hasTo(config('mail.from.address')));

        $this->assertDatabaseHas('audit_logs', ['action' => 'announcement_sent', 'user_id' => $admin->id]);
    }

    public function test_the_portal_copy_carries_the_full_message(): void
    {
        $recipient = $this->makeUser('recipient');
        Mail::fake();
        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/announcements', $this->payload())->assertStatus(201);

        Sanctum::actingAs($recipient);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.data.type', 'announcement')
            ->assertJsonPath('data.0.data.title', 'Announcement: Stipend release schedule')
            ->assertJsonPath('data.0.data.message', $this->payload()['message']);
    }

    public function test_large_lists_are_emailed_in_batches(): void
    {
        Mail::fake();
        for ($i = 0; $i < AnnouncementService::EMAIL_BATCH + 3; $i++) {
            $this->makeUser('recipient');
        }
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/announcements', $this->payload())
            ->assertStatus(201)->assertJsonPath('data.emailed_count', AnnouncementService::EMAIL_BATCH + 3);

        Mail::assertSent(AnnouncementMail::class, 2);
    }

    public function test_a_mail_outage_still_delivers_it_in_the_portal(): void
    {
        $recipient = $this->makeUser('recipient');
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('Brevo API unreachable'));
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/announcements', $this->payload())
            ->assertStatus(201)
            ->assertJsonPath('data.emailed_count', 0)
            ->assertJsonPath('message', 'Announcement sent to 1 active recipient(s) in the portal. The email reached 0 of them; check the mail settings.');

        $this->assertSame(1, $recipient->notifications()->count());
    }

    public function test_the_email_shows_the_message_as_written(): void
    {
        $html = (new AnnouncementMail(new Announcement([
            'title' => 'Schedule',
            'message' => "Line one\nLine two <b>not bold</b>\n\n# not a heading",
        ])))->render();

        $this->assertStringContainsString('Line one<br>Line two &lt;b&gt;not bold&lt;/b&gt;', $html);
        $this->assertStringContainsString('# not a heading', $html);
        $this->assertStringContainsString('Open the SWAP Portal', $html);
    }

    public function test_validation_and_empty_audience(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/announcements', ['title' => '', 'message' => 'short'])
            ->assertStatus(422)
            ->assertJsonPath('errors.title.0', 'Give the announcement a title.')
            ->assertJsonPath('errors.message.0', 'The message must be at least 10 characters.');

        // Nobody to send to (no active recipients yet).
        $this->postJson('/api/admin/announcements', $this->payload())
            ->assertStatus(422)->assertJsonPath('message', AnnouncementService::MSG_NO_RECIPIENTS);
        $this->assertSame(0, Announcement::count());
    }

    public function test_history_lists_what_was_sent_and_the_current_audience(): void
    {
        Mail::fake();
        $this->makeUser('recipient');
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);
        $this->postJson('/api/admin/announcements', $this->payload())->assertStatus(201);
        $this->makeUser('recipient');

        $this->getJson('/api/admin/announcements')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Stipend release schedule')
            ->assertJsonPath('data.0.sent_by', $admin->name)
            ->assertJsonPath('data.0.recipient_count', 1)
            ->assertJsonPath('meta.active_recipients', 2);
    }

    public function test_only_admins_can_send_or_list(): void
    {
        foreach (['applicant', 'recipient', 'supervisor'] as $role) {
            Sanctum::actingAs($this->makeUser($role));
            $this->getJson('/api/admin/announcements')->assertStatus(403);
            $this->postJson('/api/admin/announcements', $this->payload())->assertStatus(403);
        }
    }
}
