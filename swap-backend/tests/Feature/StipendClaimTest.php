<?php

namespace Tests\Feature;

use App\Events\StipendReleased;
use App\Models\StipendHistory;
use App\Notifications\StipendAvailableNotification;
use App\Notifications\StipendReleasedNotification;
use App\Services\StipendClaimService;
use App\Services\StipendService;
use App\Services\StipendSlipService;
use App\Support\BankingOfficePin;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\InspectsPdfImages;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

class StipendClaimTest extends TestCase
{
    use RefreshDatabase, MakesSwapData, InspectsPdfImages;

    private const PW = 'Password@123'; // MakesSwapData::makeUser password

    protected function setUp(): void
    {
        parent::setUp();
        // Releases render and archive PDFs; keep them out of the dev storage folder.
        Storage::fake(config('filesystems.documents_disk', 'public'));
    }

    /**
     * A recipient with an active assignment under a supervisor whose verified hours
     * already meet the requirement, with a saved signature (fixture default) and an
     * end-of-term report — i.e. payable, as every release now demands.
     */
    private function recipientWithSupervisor(int $requiredHours = 3, bool $termReport = true): array
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $supervisor, null, ['required_hours' => $requiredHours]);
        $log = $this->makeOpenLog($assignment, $recipient, now()->subHours(4));
        $log->update(['time_out' => now(), 'status' => 'verified']);
        if ($termReport) {
            $this->submitTermReport($assignment);
        }

        return [$recipient, $supervisor, $assignment];
    }

    private function releasePayload(int $userId, array $overrides = []): array
    {
        return array_merge([
            'user_id' => $userId,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'password' => self::PW,
        ], $overrides);
    }

    /** A recipient whose active assignment already meets its required hours. */
    private function eligibleRecipient(int $requiredHours = 3): \App\Models\User
    {
        return $this->recipientWithSupervisor($requiredHours)[0];
    }

    private function unlockToken(): string
    {
        return $this->postJson('/api/admin/stipend/unlock', ['password' => self::PW])
            ->assertStatus(200)
            ->json('data.unlock_token');
    }

    public function test_release_creates_a_certified_stub_signed_by_supervisor_and_admin(): void
    {
        Notification::fake();
        [$recipient, $supervisor] = $this->recipientWithSupervisor();
        $admin = $this->makeUser('admin');

        Sanctum::actingAs($admin);
        $res = $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))
            ->assertStatus(201)
            ->assertJsonPath('data.status', 'certified');

        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);
        $this->assertNotNull($stipend->control_number);
        $this->assertNotNull($stipend->claim_token);
        // Fixed semester amount applied by default.
        $this->assertEquals((float) StipendService::DEFAULT_STIPEND_AMOUNT, (float) $stipend->amount);

        // Co-signed by the supervisor (SWAP Mentor) and the certifying admin.
        $this->assertDatabaseHas('stipend_signatures', [
            'stipend_history_id' => $stipend->id, 'signatory_role' => 'supervisor', 'user_id' => $supervisor->id,
        ]);
        $this->assertDatabaseHas('stipend_signatures', [
            'stipend_history_id' => $stipend->id, 'signatory_role' => 'director', 'user_id' => $admin->id,
        ]);

        Notification::assertSentTo($recipient, StipendAvailableNotification::class);
        $this->assertStringNotContainsString($stipend->claim_token, $res->getContent());
    }

    public function test_release_requires_the_admin_step_up_password(): void
    {
        [$recipient] = $this->recipientWithSupervisor();
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id, ['password' => 'wrong-password']))
            ->assertStatus(422)->assertJsonValidationErrors('password');

        $this->assertDatabaseMissing('stipend_history', ['user_id' => $recipient->id]);
    }

    public function test_verify_endpoint_confirms_a_certified_claim_and_hides_after_it_is_claimed(): void
    {
        [$recipient] = $this->recipientWithSupervisor();
        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);

        $token = StipendHistory::firstWhere('user_id', $recipient->id)->claim_token;

        // Banking Office verifies (public, no auth).
        $this->getJson("/api/stipend/verify/{$token}")
            ->assertStatus(200)
            ->assertJsonPath('valid', true)
            ->assertJsonPath('data.status', 'certified');

        // An unknown token is rejected.
        $this->getJson('/api/stipend/verify/nope')->assertStatus(404)->assertJsonPath('valid', false);
    }

    public function test_banking_office_release_marks_claimed_consumes_token_and_notifies(): void
    {
        Notification::fake();
        [$recipient] = $this->recipientWithSupervisor();
        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);

        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);
        $token = $stipend->claim_token;

        // The releasing officer is not logged in: the scan page is public, the PIN is the gate.
        $this->app['auth']->forgetGuards();
        $this->bankingOfficeRelease($stipend)
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'claimed')
            ->assertJsonPath('data.releasing_officer_name', 'Cashier Jane Doe')
            ->assertJsonPath('message', 'Payout recorded. The stub is now marked as claimed.');

        $fresh = $stipend->fresh();
        $this->assertEquals('claimed', $fresh->status);
        $this->assertNull($fresh->claim_token, 'token must be consumed');
        $this->assertEquals('Cashier Jane Doe', $fresh->releasing_officer_name);
        $this->assertEqualsCanonicalizing(
            ['supervisor', 'director', 'beneficiary', 'releasing_officer'],
            $fresh->signatures()->pluck('signatory_role')->all(),
        );
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'claimed', 'auditable_type' => StipendHistory::class, 'auditable_id' => $stipend->id,
        ]);

        // The consumed token no longer verifies or releases: a replayed/photographed slip can't be paid twice.
        $this->getJson("/api/stipend/verify/{$token}")->assertStatus(404);
        $this->postJson("/api/stipend/verify/{$token}/release", ['pin' => self::UBO_PIN])
            ->assertStatus(404)->assertJsonPath('valid', false);
        Notification::assertSentTo($recipient, StipendReleasedNotification::class);
    }

    public function test_banking_office_release_rejects_a_wrong_pin_and_keeps_the_stub_certified(): void
    {
        $recipient = $this->eligibleRecipient();
        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);
        BankingOfficePin::set(self::UBO_PIN, 'Cashier Jane Doe');

        $this->postJson("/api/stipend/verify/{$stipend->claim_token}/release", ['pin' => '999999'])
            ->assertStatus(422)->assertJsonPath('errors.pin.0', BankingOfficePin::MSG_WRONG);

        $this->postJson("/api/stipend/verify/{$stipend->claim_token}/release", [])
            ->assertStatus(422)->assertJsonPath('errors.pin.0', 'Enter the Banking Office PIN.');

        $this->assertEquals('certified', $stipend->fresh()->status);
        $this->assertNotNull($stipend->fresh()->claim_token);
    }

    public function test_banking_office_release_is_refused_until_the_pin_is_set(): void
    {
        $recipient = $this->eligibleRecipient();
        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);

        $this->postJson("/api/stipend/verify/{$stipend->claim_token}/release", ['pin' => '123456'])
            ->assertStatus(422)->assertJsonPath('message', BankingOfficePin::MSG_NOT_SET);

        $this->assertEquals('certified', $stipend->fresh()->status);
    }

    public function test_banking_office_pin_attempts_are_throttled(): void
    {
        $recipient = $this->eligibleRecipient();
        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);
        BankingOfficePin::set(self::UBO_PIN, 'Cashier Jane Doe');
        // The officer is anonymous (keyed by IP), not the admin whose release used their own bucket.
        $this->app['auth']->forgetGuards();

        for ($i = 0; $i < 6; $i++) {
            $this->postJson("/api/stipend/verify/{$stipend->claim_token}/release", ['pin' => '00000'.$i])
                ->assertStatus(422);
        }

        // Even the right PIN is refused once the window is spent.
        $this->bankingOfficeRelease($stipend)->assertStatus(429);
        $this->assertEquals('certified', $stipend->fresh()->status);
    }

    public function test_the_stub_gets_the_officer_name_the_admin_set_not_a_typed_one(): void
    {
        [$recipient] = $this->recipientWithSupervisor();
        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);
        BankingOfficePin::set(self::UBO_PIN, 'Juan Dela Cruz');
        $this->app['auth']->forgetGuards();

        // The scan page shows who the payout will be recorded under.
        $this->getJson("/api/stipend/verify/{$stipend->claim_token}")
            ->assertOk()->assertJsonPath('data.releasing_officer_name', 'Juan Dela Cruz');

        // A name sent with the request (e.g. browser autofill) is ignored.
        $this->postJson("/api/stipend/verify/{$stipend->claim_token}/release", [
            'pin' => self::UBO_PIN, 'releasing_officer_name' => 'admin@msu-marawi.edu.ph',
        ])->assertOk()->assertJsonPath('data.releasing_officer_name', 'Juan Dela Cruz');

        $this->assertDatabaseHas('stipend_signatures', [
            'stipend_history_id' => $stipend->id, 'signatory_role' => 'releasing_officer', 'printed_name' => 'Juan Dela Cruz',
        ]);
        $html = view('stipend.slip', ['stipend' => $stipend->fresh()->load(['recipient.profile', 'signatures.user', 'certifiedBy'])])->render();
        $this->assertSame(2, substr_count($html, 'Juan Dela Cruz'), 'Return Slip + Receiving Slip');
        $this->assertStringNotContainsString('admin@msu-marawi.edu.ph', $html);

        // Changing the officer later never rewrites a stub already released.
        BankingOfficePin::set(null, 'Maria Santos');
        $this->assertSame('Juan Dela Cruz', $stipend->fresh()->releasing_officer_name);
    }

    public function test_the_student_can_no_longer_confirm_their_own_receipt(): void
    {
        [$recipient] = $this->recipientWithSupervisor();
        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);

        Sanctum::actingAs($recipient);
        $this->postJson("/api/recipient/stipend/{$stipend->id}/confirm-receipt", [
            'releasing_officer_name' => 'Cashier',
        ])->assertStatus(404);

        $this->assertEquals('certified', $stipend->fresh()->status);
    }

    public function test_a_certified_stub_carries_the_banking_office_qr_until_it_is_claimed(): void
    {
        $disk = Storage::disk(config('filesystems.documents_disk', 'public'));
        // The fixture's specimen path is not a real file and no signer holds ink:
        // the QR is the only image on the certified stub.
        [$recipient] = $this->recipientWithSupervisor();

        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);

        $images = $this->pdfImages($disk->get($stipend->slip_path));
        $this->assertCount(1, $images, 'the certified stub prints one QR');
        [$w, $h] = array_map('intval', explode('x', array_key_first($images)));
        $this->assertSame($w, $h, 'the QR is square');
        $this->assertStringEndsWith('/claim/'.$stipend->claim_token, StipendSlipService::claimUrl($stipend));

        $this->bankingOfficeRelease($stipend)->assertStatus(200);

        // Claimed: token cleared, so the re-rendered stub has no QR left to scan.
        $this->assertSame([], $this->pdfImages($disk->get($stipend->fresh()->slip_path)));
    }

    public function test_admin_sets_the_releasing_officer_and_pin_behind_the_step_up(): void
    {
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);
        $url = '/api/admin/stipend/banking-office-pin';
        $officer = ['officer_name' => 'Juan Dela Cruz', 'password' => self::PW];

        $this->getJson($url)->assertStatus(200)
            ->assertJsonPath('data.is_set', false)
            ->assertJsonPath('data.officer_name', null);

        // Step-up required; name and PIN required the first time; PIN shape enforced.
        $this->putJson($url, ['officer_name' => 'Juan Dela Cruz', 'pin' => '123456', 'pin_confirmation' => '123456'])
            ->assertStatus(422);
        $this->putJson($url, ['pin' => '123456', 'pin_confirmation' => '123456', 'password' => self::PW])
            ->assertStatus(422)->assertJsonPath('errors.officer_name.0', "Enter the releasing officer's name.");
        $this->putJson($url, $officer)
            ->assertStatus(422)->assertJsonPath('errors.pin.0', 'Enter a PIN for the releasing officer.');
        $this->putJson($url, $officer + ['pin' => '12ab', 'pin_confirmation' => '12ab'])
            ->assertStatus(422)->assertJsonPath('errors.pin.0', 'The Banking Office PIN must be 6 to 8 digits.');
        $this->putJson($url, $officer + ['pin' => '123456', 'pin_confirmation' => '654321'])
            ->assertStatus(422)->assertJsonPath('errors.pin.0', 'The two PIN entries do not match.');
        $this->assertFalse(BankingOfficePin::isSet());

        $this->putJson($url, $officer + ['pin' => '24681357', 'pin_confirmation' => '24681357'])
            ->assertStatus(200)
            ->assertJsonPath('data.is_set', true)
            ->assertJsonPath('data.officer_name', 'Juan Dela Cruz')
            ->assertJsonPath('message', 'Releasing officer and PIN saved. Give the PIN only to Juan Dela Cruz.');
        $this->assertTrue(BankingOfficePin::matches('24681357'));

        // Renaming alone keeps the PIN (another admin: this one spent the 6/min PIN window).
        Sanctum::actingAs($this->makeUser('admin'));
        $this->putJson($url, ['officer_name' => 'Maria Santos', 'password' => self::PW])
            ->assertStatus(200)
            ->assertJsonPath('data.officer_name', 'Maria Santos')
            ->assertJsonPath('message', 'Releasing officer updated. The PIN is unchanged.');
        $this->assertTrue(BankingOfficePin::matches('24681357'));

        // Audited with the names, never the PIN.
        $log = \App\Models\AuditLog::where('action', 'banking_office_pin_changed')->latest('id')->first();
        $this->assertSame('Juan Dela Cruz', $log->old_values['officer_name']);
        $this->assertSame('Maria Santos', $log->new_values['officer_name']);
        $this->assertFalse($log->new_values['pin_changed']);
        $this->assertStringNotContainsString('24681357', json_encode(\App\Models\AuditLog::pluck('new_values')));

        // Other roles can't read or change it.
        Sanctum::actingAs($this->makeUser('supervisor'));
        $this->getJson('/api/admin/stipend/banking-office-pin')->assertStatus(403);
    }

    /**
     * A SignaturePad-style specimen: RGBA PNG, fully transparent background, dark
     * strokes — the exact shape canvas.toBlob() produces.
     */
    private function transparentInkPng(int $w, int $h): string
    {
        $im = imagecreatetruecolor($w, $h);
        imagealphablending($im, false);
        imagesavealpha($im, true);
        imagefill($im, 0, 0, imagecolorallocatealpha($im, 0, 0, 0, 127));
        imagesetthickness($im, 4);
        $ink = imagecolorallocatealpha($im, 17, 17, 17, 0);
        imageline($im, 10, $h - 20, $w - 10, 20, $ink);
        imageline($im, 10, 20, $w - 10, $h - 20, $ink);
        ob_start();
        imagepng($im);

        return ob_get_clean();
    }

    /** Release as admin, then the Banking Office records the payout; returns [stipend, response]. */
    private function releaseAndConfirm(\App\Models\User $recipient): array
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);

        $res = $this->bankingOfficeRelease($stipend)->assertStatus(200);
        Sanctum::actingAs($recipient);

        return [$stipend->fresh(), $res];
    }

    public function test_confirmed_stub_shows_the_beneficiarys_transparent_drawn_ink(): void
    {
        [$recipient] = $this->recipientWithSupervisor();

        // Specimen saved through the real Profile endpoint. A distinctive size
        // identifies the beneficiary's ink among the PDF's images.
        Sanctum::actingAs($recipient);
        $this->post('/api/profile/signature', [
            'signature' => UploadedFile::fake()->createWithContent('signature.png', $this->transparentInkPng(300, 113)),
        ], ['Accept' => 'application/json'])->assertSuccessful();

        [$stipend] = $this->releaseAndConfirm($recipient->fresh());

        // The receipt's rows are on the model the PDF was rendered from.
        $this->assertEqualsCanonicalizing(
            ['supervisor', 'director', 'beneficiary', 'releasing_officer'],
            $stipend->signatures()->pluck('signatory_role')->all(),
        );

        // What the student downloads after confirming.
        $pdf = $this->get("/api/recipient/stipend/{$stipend->id}/slip")->assertStatus(200)->streamedContent();
        $images = $this->pdfImages($pdf);
        $this->assertArrayHasKey('300x113', $images, 'beneficiary ink missing from the archived stub');
        $this->assertTrue($images['300x113']['smask'], 'transparency must be kept as an alpha mask');
        $this->assertSame(2, $images['300x113']['draws'], 'ink belongs on the Return Slip and the Receiving Slip');
        $this->assertGreaterThan(0, $images['300x113']['visible_px'], 'strokes must be visible on white paper');
    }

    public function test_confirmed_stub_keeps_the_typed_fallback_without_a_specimen(): void
    {
        $disk = Storage::disk(config('filesystems.documents_disk', 'public'));
        [$recipient] = $this->recipientWithSupervisor();

        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);

        // Removed after release (release itself requires one): the receipt falls back to typed.
        $recipient->update(['signature_image_path' => null]);
        $this->bankingOfficeRelease($stipend)->assertStatus(200);
        $stipend = $stipend->fresh();

        $this->assertDatabaseHas('stipend_signatures', [
            'stipend_history_id' => $stipend->id, 'signatory_role' => 'beneficiary', 'method' => 'authenticated',
        ]);
        // Nobody holds a specimen here, so the stub carries typed lines only.
        $this->assertSame([], $this->pdfImages($disk->get($stipend->slip_path)));
    }

    public function test_slip_download_reports_a_render_failure_as_a_readable_503(): void
    {
        Log::spy();
        // The production failure: DomPDF throws when the GD extension is missing.
        $this->mock(StipendSlipService::class, fn ($mock) => $mock
            ->shouldReceive('render')
            ->andThrow(new \Exception('The PHP GD extension is required, but is not installed.')));

        [$recipient] = $this->recipientWithSupervisor();
        Sanctum::actingAs($this->makeUser('admin'));
        // A render failure at release stays non-fatal; the stub simply has no archived PDF.
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);
        $this->assertNull($stipend->slip_path);

        Sanctum::actingAs($recipient);
        $this->getJson("/api/recipient/stipend/{$stipend->id}/slip")
            ->assertStatus(503)
            ->assertJsonPath('message', 'Your claim stub could not be generated right now. Please try again in a few minutes or contact the DSA office.');

        Log::shouldHaveReceived('error')->withArgs(fn ($msg, $ctx) => $msg === 'Stipend slip render failed'
            && $ctx['stipend_id'] === $stipend->id
            && str_contains($ctx['error'], 'GD extension'))->once();
    }

    public function test_void_invalidates_the_claim_token(): void
    {
        [$recipient] = $this->recipientWithSupervisor();
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);

        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);
        $token = $stipend->claim_token;

        $this->postJson("/api/admin/stipend/{$stipend->id}/void", ['reason' => 'Duplicate release', 'password' => self::PW])
            ->assertStatus(200)->assertJsonPath('data.status', 'void');

        $this->assertNull($stipend->fresh()->claim_token);
        $this->getJson("/api/stipend/verify/{$token}")->assertStatus(404);
    }

    public function test_eligible_excludes_a_recipient_who_already_has_a_live_stipend(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        // Verified hours >= required so they qualify.
        $assignment = $this->makeAssignment($recipient, $supervisor, null, ['required_hours' => 3]);
        $log = $this->makeOpenLog($assignment, $recipient, now()->subHours(4));
        $log->update(['time_out' => now(), 'status' => 'verified']);
        $this->submitTermReport($assignment);

        Sanctum::actingAs($this->makeUser('admin'));
        $this->getJson('/api/admin/stipend/eligible')
            ->assertStatus(200)
            ->assertJsonFragment(['user_id' => $recipient->id, 'suggested_amount' => StipendService::DEFAULT_STIPEND_AMOUNT]);

        // Release a stub, then they should drop off the eligible list.
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $this->getJson('/api/admin/stipend/eligible')
            ->assertStatus(200)
            ->assertJsonMissing(['user_id' => $recipient->id]);
    }

    public function test_unlock_issues_a_token_with_the_right_password_and_rejects_a_wrong_one(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/stipend/unlock', ['password' => 'wrong-password'])
            ->assertStatus(422)->assertJsonValidationErrors('password');

        $token = $this->postJson('/api/admin/stipend/unlock', ['password' => self::PW])
            ->assertStatus(200)->json('data.unlock_token');
        $this->assertIsString($token);
        $this->assertNotEmpty($token);
    }

    public function test_single_release_accepts_the_unlock_token_instead_of_the_password(): void
    {
        $recipient = $this->eligibleRecipient();
        Sanctum::actingAs($this->makeUser('admin'));
        $token = $this->unlockToken();

        $payload = $this->releasePayload($recipient->id);
        unset($payload['password']);
        $payload['unlock_token'] = $token;

        $this->postJson('/api/admin/stipend/release', $payload)
            ->assertStatus(201)->assertJsonPath('data.status', 'certified');
    }

    public function test_bulk_release_releases_eligible_and_skips_the_rest(): void
    {
        $a = $this->eligibleRecipient();
        $b = $this->eligibleRecipient();
        $ineligible = $this->makeUser('recipient'); // no hours at all
        Sanctum::actingAs($this->makeUser('admin'));
        $token = $this->unlockToken();

        $item = fn (int $userId) => [
            'user_id' => $userId,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
        ];

        $res = $this->postJson('/api/admin/stipend/release-bulk', [
            'unlock_token' => $token,
            'items' => [$item($a->id), $item($b->id), $item($ineligible->id), $item($a->id)],
        ])->assertStatus(200);

        $this->assertCount(2, $res->json('data.released'));
        $this->assertCount(2, $res->json('data.skipped'));

        $this->assertEquals('certified', StipendHistory::firstWhere('user_id', $a->id)->status);
        $this->assertEquals('certified', StipendHistory::firstWhere('user_id', $b->id)->status);
        // One row per recipient — the intra-batch duplicate was skipped, not doubled.
        $this->assertEquals(1, StipendHistory::where('user_id', $a->id)->count());
        $this->assertNull(StipendHistory::firstWhere('user_id', $ineligible->id));
    }

    public function test_bulk_release_rejects_a_bad_unlock_token_and_releases_nothing(): void
    {
        $recipient = $this->eligibleRecipient();
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/stipend/release-bulk', [
            'unlock_token' => 'bogus-token',
            'items' => [[
                'user_id' => $recipient->id,
                'academic_year' => '2024-2025',
                'semester' => '1st Semester',
            ]],
        ])->assertStatus(422)->assertJsonValidationErrors('unlock_token');

        $this->assertDatabaseMissing('stipend_history', ['user_id' => $recipient->id]);
    }

    public function test_void_behind_the_gate_rejects_a_missing_step_up(): void
    {
        $recipient = $this->eligibleRecipient();
        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);

        $this->postJson("/api/admin/stipend/{$stipend->id}/void", ['reason' => 'No auth sent'])
            ->assertStatus(422);
        $this->assertEquals('certified', $stipend->fresh()->status);

        // …while the unlock token authorizes it.
        $this->postJson("/api/admin/stipend/{$stipend->id}/void", [
            'reason' => 'Duplicate release',
            'unlock_token' => $this->unlockToken(),
        ])->assertStatus(200)->assertJsonPath('data.status', 'void');
    }

    public function test_release_is_blocked_without_an_admin_title(): void
    {
        [$recipient] = $this->recipientWithSupervisor();
        Sanctum::actingAs($this->makeUser('admin', ['position_title' => null]));

        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))
            ->assertStatus(422);

        $this->assertDatabaseMissing('stipend_history', ['user_id' => $recipient->id]);
    }

    public function test_bulk_release_is_blocked_without_an_admin_title(): void
    {
        $recipient = $this->eligibleRecipient();
        Sanctum::actingAs($this->makeUser('admin', ['position_title' => null]));
        $token = $this->unlockToken();

        $this->postJson('/api/admin/stipend/release-bulk', [
            'unlock_token' => $token,
            'items' => [[
                'user_id' => $recipient->id,
                'academic_year' => '2024-2025',
                'semester' => '1st Semester',
            ]],
        ])->assertStatus(422);

        $this->assertDatabaseMissing('stipend_history', ['user_id' => $recipient->id]);
    }

    public function test_single_release_refuses_a_second_live_stub_for_the_period(): void
    {
        $recipient = $this->eligibleRecipient();
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))
            ->assertStatus(422)
            ->assertJsonPath('message', StipendClaimService::MSG_ALREADY_LIVE);

        $this->assertSame(1, StipendHistory::where('user_id', $recipient->id)->count());
    }

    public function test_single_release_refuses_a_recipient_who_has_not_met_their_hours(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $this->makeAssignment($recipient, $supervisor); // no verified hours
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))
            ->assertStatus(422)
            ->assertJsonPath('message', StipendClaimService::MSG_NOT_ELIGIBLE);

        $this->assertDatabaseMissing('stipend_history', ['user_id' => $recipient->id]);
    }

    public function test_a_voided_stub_frees_the_period_for_a_new_release(): void
    {
        $recipient = $this->eligibleRecipient();
        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);
        $this->postJson("/api/admin/stipend/{$stipend->id}/void", ['reason' => 'Wrong amount', 'password' => self::PW])
            ->assertStatus(200);

        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $this->assertSame(2, StipendHistory::where('user_id', $recipient->id)->count());
    }

    public function test_the_database_rejects_a_second_live_stipend_for_a_period(): void
    {
        $recipient = $this->makeUser('recipient');
        $row = [
            'user_id' => $recipient->id,
            'amount' => 5000,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'status' => StipendHistory::STATUS_CERTIFIED,
        ];
        StipendHistory::create($row);

        $this->expectException(UniqueConstraintViolationException::class);
        StipendHistory::create($row);
    }

    public function test_release_requires_the_recipients_signature_and_term_report(): void
    {
        [$noReport] = $this->recipientWithSupervisor(termReport: false);
        [$noSignature] = $this->recipientWithSupervisor();
        $noSignature->update(['signature_image_path' => null]);
        Sanctum::actingAs($this->makeUser('admin'));

        // Listed (hours met) but flagged, so the admin sees who is held back and why.
        $rows = collect($this->getJson('/api/admin/stipend/eligible')->assertOk()->json('data'))->keyBy('user_id');
        $this->assertFalse($rows[$noReport->id]['narrative_submitted']);
        $this->assertTrue($rows[$noReport->id]['has_signature']);
        $this->assertFalse($rows[$noSignature->id]['has_signature']);

        $this->postJson('/api/admin/stipend/release', $this->releasePayload($noReport->id))
            ->assertStatus(422)->assertJsonPath('message', StipendClaimService::MSG_NO_TERM_REPORT);
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($noSignature->id))
            ->assertStatus(422)->assertJsonPath('message', StipendClaimService::MSG_NO_SIGNATURE);

        // Bulk skips them with the same reasons.
        $item = fn (int $userId) => ['user_id' => $userId, 'academic_year' => '2024-2025', 'semester' => '1st Semester'];
        $res = $this->postJson('/api/admin/stipend/release-bulk', [
            'unlock_token' => $this->unlockToken(),
            'items' => [$item($noReport->id), $item($noSignature->id)],
        ])->assertOk();
        $this->assertCount(0, $res->json('data.released'));
        $this->assertEqualsCanonicalizing(
            [StipendClaimService::MSG_NO_TERM_REPORT, StipendClaimService::MSG_NO_SIGNATURE],
            collect($res->json('data.skipped'))->pluck('reason')->all(),
        );
        $this->assertSame(0, StipendHistory::count());
    }

    public function test_release_password_attempts_are_throttled(): void
    {
        $recipient = $this->eligibleRecipient();
        Sanctum::actingAs($this->makeUser('admin'));

        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id, ['password' => 'guess-'.$i]))
                ->assertStatus(422);
        }

        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id, ['password' => 'guess-7']))
            ->assertStatus(429);
    }

    public function test_banking_office_release_succeeds_even_when_the_notification_fails(): void
    {
        [$recipient] = $this->recipientWithSupervisor();
        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);

        // A mail outage after the claim is committed.
        Event::listen(StipendReleased::class, fn () => throw new \RuntimeException('SMTP connection refused'));

        $this->bankingOfficeRelease($stipend)->assertStatus(200)->assertJsonPath('data.status', 'claimed');

        $this->assertEquals('claimed', $stipend->fresh()->status);
    }

    public function test_a_signed_stub_keeps_its_ink_after_the_signers_replace_their_specimens(): void
    {
        [$recipient, $supervisor] = $this->recipientWithSupervisor();
        $saveSpecimen = function ($user, int $w, int $h) {
            Sanctum::actingAs($user);
            $this->post('/api/profile/signature', [
                'signature' => UploadedFile::fake()->createWithContent('signature.png', $this->transparentInkPng($w, $h)),
            ], ['Accept' => 'application/json'])->assertSuccessful();
        };

        // Distinctive sizes identify each signer's ink among the PDF's images.
        $saveSpecimen($supervisor, 320, 121);
        $saveSpecimen($recipient, 300, 113);
        [$stipend] = $this->releaseAndConfirm($recipient->fresh());

        // Both signers later draw new specimens (the old files are deleted)…
        $saveSpecimen($supervisor, 222, 77);
        $saveSpecimen($recipient, 211, 66);

        // …and the archived PDF is gone, so the download re-renders from the rows.
        Storage::disk(config('filesystems.documents_disk', 'public'))->delete($stipend->slip_path);

        Sanctum::actingAs($recipient);
        $pdf = $this->get("/api/recipient/stipend/{$stipend->id}/slip")->assertStatus(200)->streamedContent();
        $images = $this->pdfImages($pdf);

        $this->assertArrayHasKey('320x121', $images, 'supervisor ink must be the one signed with');
        $this->assertArrayHasKey('300x113', $images, 'beneficiary ink must be the one signed with');
        $this->assertArrayNotHasKey('222x77', $images);
        $this->assertArrayNotHasKey('211x66', $images);
    }
}
