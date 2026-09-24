<?php

namespace Tests\Feature;

use App\Models\StipendHistory;
use App\Models\User;
use App\Notifications\SignatureRequiredNotification;
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
        $this->makeAssignment($recipient, $supervisor);
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

        // The rendered stub embeds both specimens as ink, not typed lines.
        $html = view('stipend.slip', ['stipend' => $stipend->load(['recipient.profile', 'signatures', 'certifiedBy'])])->render();
        $this->assertEquals(2, substr_count($html, 'data:image/png;base64,'));
    }

    public function test_release_without_specimens_stays_typed(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $this->makeAssignment($recipient, $supervisor);
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

        $html = view('stipend.slip', ['stipend' => $stipend->load(['recipient.profile', 'signatures', 'certifiedBy'])])->render();
        $this->assertStringNotContainsString('data:image', $html);
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
        $this->makeAssignment($recipient, $supervisor);
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
        $this->makeAssignment($recipient, $supervisor);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))
            ->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);

        // The recipient fixture carries a specimen → drawn beneficiary on receipt.
        Sanctum::actingAs($recipient);
        $this->postJson("/api/recipient/stipend/{$stipend->id}/confirm-receipt", [
            'releasing_officer_name' => 'Cashier Jane Doe',
        ])->assertStatus(200);

        $html = view('stipend.slip', ['stipend' => $stipend->fresh()->load(['recipient.profile', 'signatures.user', 'certifiedBy'])])->render();

        // Auto + manual titles under the names…
        $this->assertStringContainsString('SWAP Mentor', $html);
        $this->assertStringContainsString('SWAP BENEFICIARY', $html);
        $this->assertStringContainsString('Test Director', $html);
        // …role caps and rule lines gone from the cert + beneficiary blocks…
        $this->assertStringNotContainsString('SWAP Mentor / Chairperson', $html);
        $this->assertStringNotContainsString('Noted by', $html);
        $this->assertStringNotContainsString('<span class="role">SWAP Beneficiary</span>', $html);
        // …while the external officer keeps label + line.
        $this->assertStringContainsString('Releasing Officer / Cashier', $html);
    }

    public function test_unclaimed_stub_preprints_the_beneficiary_to_be_signed(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $this->makeAssignment($recipient, $supervisor);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))
            ->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);

        $html = view('stipend.slip', ['stipend' => $stipend->load(['recipient.profile', 'signatures.user', 'certifiedBy'])])->render();

        // Beneficiary blocks read "to be signed by": name + title, no gray placeholder…
        $this->assertStringContainsString($recipient->name, $html);
        $this->assertStringContainsString('SWAP BENEFICIARY', $html);
        $this->assertStringNotContainsString('(not yet signed)', explode('Releasing Officer / Cashier', $html)[0]);
        // …while the external officer blocks keep the placeholder.
        $this->assertStringContainsString('(not yet signed)', $html);
    }

    public function test_confirm_without_specimen_falls_back_to_typed_receipt(): void
    {
        $supervisor = $this->makeUser('supervisor');
        // Explicit null: the fixture default carries a stub path.
        $recipient = $this->makeUser('recipient', ['signature_image_path' => null]);
        $this->makeAssignment($recipient, $supervisor);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))
            ->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);

        Sanctum::actingAs($recipient);
        $this->postJson("/api/recipient/stipend/{$stipend->id}/confirm-receipt", [
            'releasing_officer_name' => 'Cashier Jane Doe',
        ])->assertStatus(200)->assertJsonPath('data.status', 'claimed');

        // Typed fallback: recorded, but no ink on the re-rendered stub.
        $this->assertDatabaseHas('stipend_signatures', [
            'stipend_history_id' => $stipend->id, 'signatory_role' => 'beneficiary', 'method' => 'authenticated',
        ]);
        $html = view('stipend.slip', ['stipend' => $stipend->fresh()->load(['recipient.profile', 'signatures.user', 'certifiedBy'])])->render();
        $this->assertStringContainsString($recipient->name, $html);
        $this->assertStringContainsString('SWAP BENEFICIARY', $html);
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
}
