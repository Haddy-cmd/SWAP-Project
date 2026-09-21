<?php

namespace Tests\Feature;

use App\Models\StipendHistory;
use App\Notifications\StipendAvailableNotification;
use App\Notifications\StipendReleasedNotification;
use App\Services\StipendService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

class StipendClaimTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private const PW = 'Password@123'; // MakesSwapData::makeUser password

    /** A recipient with an active assignment under a supervisor. */
    private function recipientWithSupervisor(): array
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $this->makeAssignment($recipient, $supervisor);

        return [$recipient, $supervisor];
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

    public function test_confirm_receipt_marks_claimed_consumes_token_and_notifies(): void
    {
        Notification::fake();
        [$recipient] = $this->recipientWithSupervisor();
        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);

        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);
        $token = $stipend->claim_token;

        Sanctum::actingAs($recipient);
        $this->postJson("/api/recipient/stipend/{$stipend->id}/confirm-receipt", [
            'password' => self::PW,
            'releasing_officer_name' => 'Cashier Jane Doe',
        ])->assertStatus(200)->assertJsonPath('data.status', 'claimed');

        $fresh = $stipend->fresh();
        $this->assertEquals('claimed', $fresh->status);
        $this->assertNull($fresh->claim_token, 'token must be consumed');
        $this->assertEquals('Cashier Jane Doe', $fresh->releasing_officer_name);

        // The consumed token no longer verifies — a replayed/photographed slip can't be paid twice.
        $this->getJson("/api/stipend/verify/{$token}")->assertStatus(404);
        Notification::assertSentTo($recipient, StipendReleasedNotification::class);
    }

    public function test_confirm_receipt_rejects_a_non_owner(): void
    {
        [$recipient] = $this->recipientWithSupervisor();
        Sanctum::actingAs($this->makeUser('admin'));
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);
        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);

        [$other] = $this->recipientWithSupervisor();
        Sanctum::actingAs($other);
        $this->postJson("/api/recipient/stipend/{$stipend->id}/confirm-receipt", [
            'password' => self::PW,
            'releasing_officer_name' => 'Cashier',
        ])->assertStatus(422);

        $this->assertEquals('certified', $stipend->fresh()->status);
    }

    public function test_void_invalidates_the_claim_token(): void
    {
        [$recipient] = $this->recipientWithSupervisor();
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);
        $this->postJson('/api/admin/stipend/release', $this->releasePayload($recipient->id))->assertStatus(201);

        $stipend = StipendHistory::firstWhere('user_id', $recipient->id);
        $token = $stipend->claim_token;

        $this->postJson("/api/admin/stipend/{$stipend->id}/void", ['reason' => 'Duplicate release'])
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
}
