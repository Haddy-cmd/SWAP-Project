<?php

namespace Tests\Feature;

use App\Events\StipendReleased;
use App\Models\StipendHistory;
use App\Notifications\StipendReleasedNotification;
use App\Services\StipendClaimService;
use App\Services\StipendService;
use App\Services\StipendSlipService;
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

    public function test_release_is_final_and_signed_by_supervisor_director_and_beneficiary(): void
    {
        Notification::fake();
        [$recipient, $supervisor] = $this->recipientWithSupervisor();
        $admin = $this->makeUser('admin');

        Sanctum::actingAs($admin);
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))
            ->assertStatus(201)
            ->assertJsonPath('data.status', 'released')
            ->assertJsonPath('data.has_slip', true)
            ->assertJsonPath('message', 'Stipend released. The recipient has been notified.');

        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);
        $this->assertNotNull($stipend->control_number);
        // No QR to scan any more: nothing is generated for the Banking Office.
        $this->assertNull($stipend->claim_token);
        $this->assertNull($stipend->releasing_officer_name);
        $this->assertSame($admin->id, $stipend->released_by);
        $this->assertNotNull($stipend->released_at);
        // Fixed semester amount applied by default.
        $this->assertEquals((float) StipendService::DEFAULT_STIPEND_AMOUNT, (float) $stipend->amount);

        // Signed by the supervisor (SWAP Mentor), the releasing admin and the student, at release.
        $this->assertEqualsCanonicalizing(
            ['supervisor', 'director', 'beneficiary'],
            $stipend->signatures()->pluck('signatory_role')->all(),
        );
        $this->assertDatabaseHas('stipend_signatures', [
            'stipend_history_id' => $stipend->id, 'signatory_role' => 'supervisor', 'user_id' => $supervisor->id,
        ]);
        $this->assertDatabaseHas('stipend_signatures', [
            'stipend_history_id' => $stipend->id, 'signatory_role' => 'director', 'user_id' => $admin->id,
        ]);
        // The saved specimen is copied to the stub, so a later redraw doesn't change it.
        $this->assertDatabaseHas('stipend_signatures', [
            'stipend_history_id' => $stipend->id, 'signatory_role' => 'beneficiary', 'user_id' => $recipient->id,
            'method' => 'drawn', 'signature_image_path' => "stipend-signatures/{$stipend->id}/beneficiary.png",
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'released', 'auditable_type' => StipendHistory::class, 'auditable_id' => $stipend->id,
        ]);

        Notification::assertSentTo($recipient, StipendReleasedNotification::class, function ($n) use ($recipient, $stipend) {
            $mail = $n->toMail($recipient);

            return $mail->subject === 'SWAP Stipend Released'
                && str_contains(implode(' ', $mail->introLines), $stipend->control_number);
        });
        Notification::assertSentTimes(StipendReleasedNotification::class, 1);
    }

    public function test_release_requires_the_admin_step_up_password(): void
    {
        [$recipient] = $this->recipientWithSupervisor();
        Sanctum::actingAs($this->makeUser('admin'));

        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id, ['password' => 'wrong-password']))
            ->assertStatus(422)->assertJsonValidationErrors('password');

        $this->assertDatabaseMissing('stipend_history', ['user_id' => $recipient->id]);
    }

    public function test_the_banking_office_scan_and_pin_routes_are_gone(): void
    {
        $recipient = $this->eligibleRecipient();
        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);

        $this->getJson('/api/stipend/verify/any-token')->assertStatus(404);
        $this->postJson('/api/stipend/verify/any-token/release', ['pin' => '123456'])->assertStatus(404);
        $this->getJson('/api/admin/stipend/banking-office-pin')->assertStatus(404);
        $this->putJson('/api/admin/stipend/banking-office-pin', ['officer_name' => 'Cashier', 'pin' => '123456'])
            ->assertStatus(404);

        $this->assertSame('released', StipendHistory::firstWhere('user_id', $recipient->id)->status);
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

        $this->assertEquals('released', $stipend->fresh()->status);
    }

    public function test_the_released_stub_has_no_qr_and_no_releasing_officer(): void
    {
        $disk = Storage::disk(config('filesystems.documents_disk', 'public'));
        // No supervisor or admin holds ink: the only image on the stub is the beneficiary's
        // (the fixture's 1×1 specimen), signed at release. No QR is printed.
        [$recipient] = $this->recipientWithSupervisor();

        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);

        $this->assertSame(['1x1'], array_keys($this->pdfImages($disk->get($stipend->slip_path))));
        $this->assertSame(2, $this->pdfImages($disk->get($stipend->slip_path))['1x1']['draws'], 'Return Slip + Receiving Slip');

        $html = view('stipend.slip', ['stipend' => $stipend->fresh()->load(['recipient.profile', 'signatures.user', 'certifiedBy'])])->render();
        $this->assertStringNotContainsString('Releasing Officer', $html);
        $this->assertStringNotContainsString('/claim/', $html);
        $this->assertStringNotContainsString('Banking Office', $html);
        $this->assertStringContainsString('DSA COPY', $html);
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

    /** Release as admin (final, signed by the student too); returns [stipend, response] acting as the recipient. */
    private function releaseAs(\App\Models\User $recipient): array
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $res = $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        Sanctum::actingAs($recipient);

        return [StipendHistory::firstWhere('user_id', $recipient->id), $res];
    }

    public function test_released_stub_shows_the_beneficiarys_transparent_drawn_ink(): void
    {
        [$recipient] = $this->recipientWithSupervisor();

        // Specimen saved through the real Profile endpoint. A distinctive size
        // identifies the beneficiary's ink among the PDF's images.
        Sanctum::actingAs($recipient);
        $this->post('/api/profile/signature', [
            'signature' => UploadedFile::fake()->createWithContent('signature.png', $this->transparentInkPng(300, 113)),
        ], ['Accept' => 'application/json'])->assertSuccessful();

        [$stipend] = $this->releaseAs($recipient->fresh());

        // The receipt's rows are on the model the PDF was rendered from.
        $this->assertEqualsCanonicalizing(
            ['supervisor', 'director', 'beneficiary'],
            $stipend->signatures()->pluck('signatory_role')->all(),
        );

        // What the student downloads once released.
        $pdf = $this->get("/api/recipient/stipend/{$stipend->id}/slip")->assertStatus(200)->streamedContent();
        $images = $this->pdfImages($pdf);
        $this->assertArrayHasKey('300x113', $images, 'beneficiary ink missing from the archived stub');
        $this->assertTrue($images['300x113']['smask'], 'transparency must be kept as an alpha mask');
        $this->assertSame(2, $images['300x113']['draws'], 'ink belongs on the Return Slip and the Receiving Slip');
        $this->assertGreaterThan(0, $images['300x113']['visible_px'], 'strokes must be visible on white paper');
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

    public function test_void_on_a_released_stub_needs_a_reason_and_makes_the_recipient_eligible_again(): void
    {
        [$recipient] = $this->recipientWithSupervisor();
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);

        $this->postJson("/api/admin/stipend/{$stipend->id}/void", ['password' => self::PW])
            ->assertStatus(422)->assertJsonValidationErrors('reason');

        $this->postJson("/api/admin/stipend/{$stipend->id}/void", ['reason' => 'Duplicate release', 'password' => self::PW])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'void')
            ->assertJsonPath('message', 'Stipend voided. The recipient can be released a new stub.');

        $fresh = $stipend->fresh();
        $this->assertSame('Duplicate release', $fresh->void_reason);
        $this->assertNotNull($fresh->voided_at);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'voided', 'auditable_type' => StipendHistory::class, 'auditable_id' => $stipend->id,
        ]);
        $this->getJson('/api/admin/stipend/eligible')->assertOk()->assertJsonFragment(['user_id' => $recipient->id]);

        // Voiding twice is refused with a readable reason.
        $this->postJson("/api/admin/stipend/{$stipend->id}/void", ['reason' => 'Again', 'password' => self::PW])
            ->assertStatus(422)->assertJsonPath('message', StipendClaimService::MSG_ALREADY_VOID);
    }

    public function test_a_legacy_stub_received_at_the_banking_office_cannot_be_voided(): void
    {
        $recipient = $this->makeUser('recipient');
        $stipend = StipendHistory::create([
            'user_id' => $recipient->id,
            'amount' => 5000,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'status' => StipendHistory::STATUS_CLAIMED,
            'claimed_at' => now()->subMonth(),
        ]);

        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson("/api/admin/stipend/{$stipend->id}/void", ['reason' => 'Mistake', 'password' => self::PW])
            ->assertStatus(422)->assertJsonPath('message', StipendClaimService::MSG_NOT_VOIDABLE);

        $this->assertSame('claimed', $stipend->fresh()->status);
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
            ->assertStatus(201)->assertJsonPath('data.status', 'released');
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

        foreach ([$a, $b] as $recipient) {
            $stub = StipendHistory::firstWhere('user_id', $recipient->id);
            $this->assertEquals('released', $stub->status);
            $this->assertNull($stub->claim_token);
            $this->assertEqualsCanonicalizing(
                ['supervisor', 'director', 'beneficiary'],
                $stub->signatures()->pluck('signatory_role')->all(),
            );
        }
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
        $this->assertEquals('released', $stipend->fresh()->status);

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
            'status' => StipendHistory::STATUS_RELEASED,
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

    public function test_release_succeeds_even_when_the_notification_fails(): void
    {
        [$recipient] = $this->recipientWithSupervisor();
        // A mail outage after the release is committed.
        Event::listen(StipendReleased::class, fn () => throw new \RuntimeException('SMTP connection refused'));

        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))
            ->assertStatus(201)->assertJsonPath('data.status', 'released');

        $this->assertEquals('released', StipendHistory::firstWhere('user_id', $recipient->id)->status);
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
        [$stipend] = $this->releaseAs($recipient->fresh());

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
