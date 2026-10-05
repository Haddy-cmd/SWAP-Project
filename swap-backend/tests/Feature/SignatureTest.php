<?php

namespace Tests\Feature;

use App\Models\StipendHistory;
use App\Models\StipendSignature;
use App\Models\User;
use App\Notifications\SignatureRequiredNotification;
use App\Services\StipendClaimService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * Digital-signature specimens: upload/remove on the profile, auto-application
 * to director + mentor signatures at release, ink rendering on the stub PDF,
 * and the serve policy (self, admin, supervising supervisor — nobody else).
 */
class SignatureTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private const PW = 'Password@123'; // MakesSwapData::makeUser password

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function tokenFor(User $user): string
    {
        return $user->createToken('test')->plainTextToken;
    }

    /** An active assignment whose verified hours already meet the requirement (releasable). */
    private function payableAssignment(User $recipient, User $supervisor): void
    {
        $assignment = $this->makeAssignment($recipient, $supervisor, null, ['required_hours' => 3]);
        $log = $this->makeOpenLog($assignment, $recipient, now()->subHours(4));
        $log->update(['time_out' => now(), 'status' => 'verified']);
        $this->submitTermReport($assignment);
    }

    private function releasePayload(int $userId): array
    {
        return [
            'user_id' => $userId,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'password' => self::PW,
        ];
    }

    public function test_specimen_upload_and_remove(): void
    {
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);

        $this->postJson('/api/profile/signature', [
            'signature' => UploadedFile::fake()->image('sig.png'),
        ])->assertStatus(200)->assertJsonPath('data.signature_url', fn ($url) => is_string($url));

        $path = $admin->fresh()->signature_image_path;
        $this->assertNotNull($path);
        Storage::disk('public')->assertExists($path);

        $this->deleteJson('/api/profile/signature')->assertStatus(200)
            ->assertJsonPath('data.signature_url', null);
        $this->assertNull($admin->fresh()->signature_image_path);
        Storage::disk('public')->assertMissing($path);
    }

    public function test_specimen_rejects_non_images(): void
    {
        Sanctum::actingAs($this->makeUser('supervisor'));

        $this->postJson('/api/profile/signature', [
            'signature' => UploadedFile::fake()->create('sig.pdf', 50, 'application/pdf'),
        ])->assertStatus(422)->assertJsonValidationErrors('signature');
    }

    public function test_release_applies_drawn_specimens_and_renders_ink_on_the_stub(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $this->payableAssignment($recipient, $supervisor);
        $admin = $this->makeUser('admin');

        Sanctum::actingAs($supervisor);
        $this->postJson('/api/profile/signature', ['signature' => UploadedFile::fake()->image('mentor.png')])
            ->assertStatus(200);

        Sanctum::actingAs($admin);
        $this->postJson('/api/profile/signature', ['signature' => UploadedFile::fake()->image('director.png')])
            ->assertStatus(200);
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))
            ->assertStatus(201);

        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);
        $this->assertDatabaseHas('stipend_signatures', [
            'stipend_history_id' => $stipend->id, 'signatory_role' => 'director', 'method' => 'drawn',
        ]);
        $this->assertDatabaseHas('stipend_signatures', [
            'stipend_history_id' => $stipend->id, 'signatory_role' => 'supervisor', 'method' => 'drawn',
        ]);
        $this->assertDatabaseHas('stipend_signatures', [
            'stipend_history_id' => $stipend->id, 'signatory_role' => 'beneficiary', 'method' => 'drawn',
        ]);

        // The rendered stub embeds every specimen as ink, not typed lines: mentor and
        // director on the certificate, the student on the Return and Receiving Slips.
        $html = view('stipend.slip', ['stipend' => $stipend->load(['recipient.profile', 'signatures', 'certifiedBy'])])->render();
        $this->assertEquals(4, substr_count($html, 'data:image/png;base64,'));
    }

    public function test_release_without_staff_specimens_types_their_lines(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $this->payableAssignment($recipient, $supervisor);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))
            ->assertStatus(201);

        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);
        $this->assertDatabaseHas('stipend_signatures', [
            'stipend_history_id' => $stipend->id, 'signatory_role' => 'director', 'method' => 'authenticated',
        ]);
        $this->assertDatabaseHas('stipend_signatures', [
            'stipend_history_id' => $stipend->id, 'signatory_role' => 'supervisor', 'method' => 'authenticated',
        ]);

        // Only the student's ink (release requires their specimen), on the two slips.
        $html = view('stipend.slip', ['stipend' => $stipend->load(['recipient.profile', 'signatures', 'certifiedBy'])])->render();
        $this->assertEquals(2, substr_count($html, 'data:image'));
    }

    public function test_signature_serve_policy(): void
    {
        // Specimens belong to signing staff; the realistic circle is self + admin.
        // (supervises() keys off student assignments, so a fellow supervisor
        // correctly gets 403 for another supervisor's specimen.)
        $owner = $this->makeUser('supervisor');
        $owner->update(['signature_image_path' => 'signatures/x.png']);
        Storage::disk('public')->put('signatures/x.png', 'img-bytes');

        $url = "/api/users/{$owner->id}/signature?token=";
        $this->get($url.urlencode($this->tokenFor($owner)))->assertOk();
        $this->get($url.urlencode($this->tokenFor($this->makeUser('admin'))))->assertOk();
        $this->get($url.urlencode($this->tokenFor($this->makeUser('supervisor'))))->assertStatus(403);
        $this->get($url.urlencode($this->tokenFor($this->makeUser('recipient'))))->assertStatus(403);
        $this->get("/api/users/{$owner->id}/signature")->assertStatus(401);
    }

    public function test_recipient_may_view_only_their_own_supervisors_signature(): void
    {
        // The duty slip prints the supervisor of record's ink on the student's own slip.
        $supervisor = $this->makeUser('supervisor', ['signature_image_path' => 'signatures/mentor.png']);
        $other = $this->makeUser('supervisor', ['signature_image_path' => 'signatures/other.png']);
        Storage::disk('public')->put('signatures/mentor.png', 'img-bytes');
        Storage::disk('public')->put('signatures/other.png', 'img-bytes');

        $recipient = $this->makeUser('recipient');
        $this->makeAssignment($recipient, $supervisor);
        $token = urlencode($this->tokenFor($recipient));

        $this->get("/api/users/{$supervisor->id}/signature?token={$token}")->assertOk();
        $this->get("/api/users/{$other->id}/signature?token={$token}")->assertStatus(403);

        // Once the assignment is no longer active, the access goes with it.
        $recipient->assignment()->update(['status' => 'completed']);
        $this->get("/api/users/{$supervisor->id}/signature?token={$token}")->assertStatus(403);
    }

    public function test_student_summary_exposes_both_duty_slip_specimens(): void
    {
        $supervisor = $this->makeUser('supervisor', ['signature_image_path' => 'signatures/mentor.png']);
        $recipient = $this->makeUser('recipient', ['signature_image_path' => 'signatures/student.png']);
        $this->makeAssignment($recipient, $supervisor);

        Sanctum::actingAs($supervisor);
        $this->getJson("/api/supervisor/students/{$recipient->id}/summary")
            ->assertOk()
            ->assertJsonPath('student.signature_url', $recipient->signatureUrl())
            ->assertJsonPath('student.supervisor_signature_url', $supervisor->signatureUrl());

        // No specimen on file → null, so the slip keeps the typed name.
        $supervisor->update(['signature_image_path' => null]);
        $this->getJson("/api/supervisor/students/{$recipient->id}/summary")
            ->assertOk()
            ->assertJsonPath('student.supervisor_signature_url', null);
    }

    public function test_position_title_saved_and_cleared_via_profile(): void
    {
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);

        $this->putJson('/api/profile', ['position_title' => 'Director, Division of Student Affairs'])
            ->assertStatus(200)->assertJsonPath('data.position_title', 'Director, Division of Student Affairs');
        $this->assertEquals('Director, Division of Student Affairs', $admin->fresh()->position_title);

        $this->putJson('/api/profile', ['position_title' => str_repeat('x', 151)])
            ->assertStatus(422)->assertJsonValidationErrors('position_title');

        $this->putJson('/api/profile', ['position_title' => null])->assertStatus(200);
        $this->assertNull($admin->fresh()->position_title);
    }

    public function test_stub_renders_director_title_only_when_set(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $this->payableAssignment($recipient, $supervisor);
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);

        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))
            ->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);

        // Fixture admins carry 'Test Director'; the title renders live from the
        // user row, so renaming and clearing it flips the stub output.
        $titled = view('stipend.slip', ['stipend' => $stipend->load(['recipient.profile', 'signatures.user', 'certifiedBy'])])->render();
        $this->assertStringContainsString('Test Director', $titled);

        $admin->update(['position_title' => 'Director, Division of Student Affairs']);
        $renamed = view('stipend.slip', ['stipend' => $stipend->fresh()->load(['recipient.profile', 'signatures.user', 'certifiedBy'])])->render();
        $this->assertStringContainsString('Director, Division of Student Affairs', $renamed);

        $admin->update(['position_title' => null]);
        $plain = view('stipend.slip', ['stipend' => $stipend->fresh()->load(['recipient.profile', 'signatures.user', 'certifiedBy'])])->render();
        // Mentor + both pre-printed beneficiary blocks keep titles; only the
        // director line is gone.
        $this->assertEquals(3, substr_count($plain, '<span class="sigtitle">'));
        $this->assertStringContainsString('SWAP Mentor', $plain);
        $this->assertStringContainsString('SWAP BENEFICIARY', $plain);
    }

    public function test_stub_renders_auto_titles_and_no_role_caps(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $this->payableAssignment($recipient, $supervisor);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))
            ->assertStatus(201);
        // The recipient fixture carries a specimen → drawn beneficiary at release.
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);

        $html = view('stipend.slip', ['stipend' => $stipend->fresh()->load(['recipient.profile', 'signatures.user', 'certifiedBy'])])->render();

        // Auto + manual titles under the names…
        $this->assertStringContainsString('SWAP Mentor', $html);
        $this->assertStringContainsString('SWAP BENEFICIARY', $html);
        $this->assertStringContainsString('Test Director', $html);
        // …role caps and rule lines gone from the cert + beneficiary blocks…
        $this->assertStringNotContainsString('SWAP Mentor / Chairperson', $html);
        $this->assertStringNotContainsString('Noted by', $html);
        $this->assertStringNotContainsString('<span class="role">SWAP Beneficiary</span>', $html);
        // …and no releasing officer column: the release is final.
        $this->assertStringNotContainsString('Releasing Officer', $html);
    }

    public function test_released_stub_prints_the_beneficiary_already_signed(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $this->payableAssignment($recipient, $supervisor);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))
            ->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);

        $html = view('stipend.slip', ['stipend' => $stipend->load(['recipient.profile', 'signatures.user', 'certifiedBy'])])->render();

        // Every block is signed: name + title + "signed …", no gray placeholder anywhere.
        $this->assertStringContainsString($recipient->name, $html);
        $this->assertStringContainsString('SWAP BENEFICIARY', $html);
        $this->assertStringNotContainsString('(not yet signed)', $html);
        $this->assertSame(4, substr_count($html, 'signed '.now('Asia/Manila')->format('M j, Y')), 'mentor, director, beneficiary ×2');
    }

    public function test_reminder_command_nudges_only_specimen_less_recipients_once(): void
    {
        // No Notification::fake here: the dedupe reads persisted rows, and mail
        // goes to the array transport in tests (phpunit.xml) anyway.
        $missing = $this->makeUser('recipient', ['signature_image_path' => null]);
        $holder = $this->makeUser('recipient');
        $admin = $this->makeUser('admin');

        $this->artisan('remind:missing-signatures')->assertSuccessful();

        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $missing->id, 'type' => SignatureRequiredNotification::class, 'read_at' => null,
        ]);
        $this->assertDatabaseMissing('notifications', ['notifiable_id' => $holder->id]);
        $this->assertDatabaseMissing('notifications', ['notifiable_id' => $admin->id]);

        // Second run: the unread reminder suppresses the duplicate.
        $this->artisan('remind:missing-signatures')->assertSuccessful();
        $this->assertEquals(1, $missing->notifications()->count());
    }

    public function test_profile_flags_a_signature_whose_file_was_lost(): void
    {
        $recipient = $this->makeUser('recipient', ['signature_image_path' => null]);
        Sanctum::actingAs($recipient);

        $this->getJson('/api/profile')->assertStatus(200)->assertJsonPath('data.signature_missing', false);

        $this->postJson('/api/profile/signature', ['signature' => UploadedFile::fake()->image('me.png')])->assertStatus(200);
        $this->getJson('/api/profile')->assertJsonPath('data.signature_missing', false);

        // e.g. saved on the server's own disk, which the host wiped on restart
        Storage::disk('public')->delete($recipient->fresh()->signature_image_path);
        $this->getJson('/api/profile')->assertStatus(200)
            ->assertJsonPath('data.signature_missing', true)
            ->assertJsonPath('data.signature_url', fn ($url) => is_string($url));
    }

    public function test_release_refuses_a_recipient_whose_signature_file_was_lost(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $this->payableAssignment($recipient, $supervisor);
        Storage::disk('public')->delete($recipient->signature_image_path);

        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))
            ->assertStatus(422)
            ->assertJsonPath('message', StipendClaimService::MSG_SIGNATURE_LOST);

        $token = $this->postJson('/api/admin/stipend/unlock', ['password' => self::PW])->json('data.unlock_token');
        $this->postJson('/api/admin/stipend/release-bulk', [
            'unlock_token' => $token,
            'items' => [['user_id' => $recipient->id, 'academic_year' => '2024-2025', 'semester' => '1st Semester']],
        ])->assertStatus(200)
            ->assertJsonPath('data.released', [])
            ->assertJsonPath('data.skipped.0.reason', StipendClaimService::MSG_SIGNATURE_LOST);
        $this->assertDatabaseCount('stipend_history', 0);
    }

    public function test_redrawing_puts_the_ink_back_on_a_stub_whose_copy_was_lost(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $this->payableAssignment($recipient, $supervisor);

        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);
        $this->assertSame('released', $stipend->status);

        $ink = StipendSignature::where('stipend_history_id', $stipend->id)->where('signatory_role', 'beneficiary')->first();
        $this->assertSame('drawn', $ink->method);
        $this->assertNotNull($stipend->fresh()->slip_path);

        // Storage lost the stub's copy and the specimen itself.
        Storage::disk('public')->delete([$ink->signature_image_path, $recipient->signature_image_path]);

        Sanctum::actingAs($recipient);
        $this->postJson('/api/profile/signature', ['signature' => UploadedFile::fake()->image('again.png')])
            ->assertStatus(200)
            ->assertJsonPath('message', 'Digital signature saved. It will appear on newly released claim stubs. It was also put back on 1 claim stub whose signature image had been lost.');

        Storage::disk('public')->assertExists($ink->fresh()->signature_image_path);
        $this->assertNull($stipend->fresh()->slip_path, 'the next download re-renders the stub with ink');
        $this->assertDatabaseHas('audit_logs', ['action' => 'stipend_signature_restored', 'auditable_id' => $stipend->id]);
        // A signer who never drew is left alone.
        $this->assertDatabaseHas('stipend_signatures', [
            'stipend_history_id' => $stipend->id, 'signatory_role' => 'supervisor', 'method' => 'authenticated', 'signature_image_path' => null,
        ]);

        // The download renders a fresh stub; a second drawing finds nothing lost.
        $this->get("/api/recipient/stipend/{$stipend->id}/slip")->assertStatus(200);
        $this->assertNotNull($stipend->fresh()->slip_path);
        $this->postJson('/api/profile/signature', ['signature' => UploadedFile::fake()->image('third.png')])
            ->assertJsonPath('message', 'Digital signature saved. It will appear on newly released claim stubs.');
    }
}
