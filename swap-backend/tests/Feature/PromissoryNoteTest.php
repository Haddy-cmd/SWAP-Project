<?php

namespace Tests\Feature;

use App\Models\PromissoryNote;
use App\Notifications\PromissoryReviewedNotification;
use App\Notifications\PromissorySubmittedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

class PromissoryNoteTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private const PW = 'Password@123'; // MakesSwapData::makeUser password

    /** An assignment whose semester already ended (Manila, yesterday). */
    private function pastAssignment($recipient, $supervisor, array $attrs = [])
    {
        return $this->makeAssignment($recipient, $supervisor, null, array_merge([
            'required_hours' => 200,
            'start_date' => Carbon::now('Asia/Manila')->subMonths(5)->toDateString(),
            'end_date' => Carbon::now('Asia/Manila')->subDay()->toDateString(),
        ], $attrs));
    }

    private function submitPayload(int $assignmentId, array $overrides = []): array
    {
        return array_merge([
            'assignment_id' => $assignmentId,
            'reason' => 'Fell short during exam weeks; will render the lacking hours ASAP.',
            'file' => UploadedFile::fake()->create('promissory.pdf', 50, 'application/pdf'),
        ], $overrides);
    }

    public function test_submit_after_semester_end_creates_a_pending_note_and_notifies_supervisors(): void
    {
        Storage::fake('public');
        Notification::fake();
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->pastAssignment($recipient, $supervisor);

        Sanctum::actingAs($recipient);
        $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))
            ->assertStatus(201)
            ->assertJsonPath('data.status', 'pending');

        $note = PromissoryNote::firstWhere('assignment_id', $assignment->id);
        $this->assertNotNull($note);
        $this->assertEquals(200.0, (float) $note->lacking_hours);
        $this->assertEquals(0.0, (float) $note->verified_hours_snapshot);
        Storage::disk('public')->assertExists($note->file_path);

        Notification::assertSentTo($supervisor, PromissorySubmittedNotification::class);
    }

    public function test_submit_before_semester_end_is_rejected(): void
    {
        Storage::fake('public');
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $supervisor, null, [
            'required_hours' => 200,
            'end_date' => Carbon::now('Asia/Manila')->addMonth()->toDateString(),
        ]);

        Sanctum::actingAs($recipient);
        $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))
            ->assertStatus(422);

        $this->assertDatabaseMissing('promissory_notes', ['assignment_id' => $assignment->id]);
    }

    public function test_submit_with_completed_hours_is_rejected(): void
    {
        Storage::fake('public');
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->pastAssignment($recipient, $supervisor, ['required_hours' => 3]);
        $log = $this->makeOpenLog($assignment, $recipient, now()->subHours(4));
        $log->update(['time_out' => now(), 'status' => 'verified']);

        Sanctum::actingAs($recipient);
        $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))
            ->assertStatus(422);
    }

    public function test_second_pending_submit_is_rejected(): void
    {
        Storage::fake('public');
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->pastAssignment($recipient, $supervisor);

        Sanctum::actingAs($recipient);
        $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))->assertStatus(201);
        $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))->assertStatus(422);
    }

    public function test_approve_sets_lacking_hours_and_a_plus_7_day_deadline(): void
    {
        Notification::fake();
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->pastAssignment($recipient, $supervisor);

        Sanctum::actingAs($recipient);
        Storage::fake('public');
        $id = $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))
            ->assertStatus(201)->json('data.id');

        Sanctum::actingAs($supervisor);
        $this->postJson("/api/supervisor/promissory/{$id}/review", [
            'action' => 'approve',
            'lacking_hours' => 200,
        ])->assertStatus(200)->assertJsonPath('data.status', 'approved');

        $note = PromissoryNote::find($id);
        $expectedDeadline = Carbon::parse($assignment->end_date->toDateString(), 'Asia/Manila')->addDays(7)->toDateString();
        $this->assertEquals($expectedDeadline, $note->makeup_deadline->toDateString());
        $this->assertEquals($supervisor->id, $note->reviewed_by);
        $this->assertNotNull($note->reviewed_at);

        Notification::assertSentTo($recipient, PromissoryReviewedNotification::class);
    }

    public function test_reject_requires_remarks(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->pastAssignment($recipient, $supervisor);

        Sanctum::actingAs($recipient);
        Storage::fake('public');
        $id = $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))
            ->assertStatus(201)->json('data.id');

        Sanctum::actingAs($supervisor);
        $this->postJson("/api/supervisor/promissory/{$id}/review", ['action' => 'reject'])
            ->assertStatus(422);

        $this->postJson("/api/supervisor/promissory/{$id}/review", [
            'action' => 'reject',
            'review_remarks' => 'Insufficient justification.',
        ])->assertStatus(200)->assertJsonPath('data.status', 'rejected');
    }

    public function test_review_by_a_non_governing_supervisor_is_not_found(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->pastAssignment($recipient, $supervisor);

        Sanctum::actingAs($recipient);
        Storage::fake('public');
        $id = $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))
            ->assertStatus(201)->json('data.id');

        Sanctum::actingAs($this->makeUser('supervisor'));
        $this->postJson("/api/supervisor/promissory/{$id}/review", [
            'action' => 'approve',
            'lacking_hours' => 200,
        ])->assertStatus(404);

        $this->assertEquals('pending', PromissoryNote::find($id)->status);
    }

    public function test_reviewing_an_already_decided_note_is_rejected(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->pastAssignment($recipient, $supervisor);

        Sanctum::actingAs($recipient);
        Storage::fake('public');
        $id = $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))
            ->assertStatus(201)->json('data.id');

        Sanctum::actingAs($supervisor);
        $this->postJson("/api/supervisor/promissory/{$id}/review", [
            'action' => 'approve',
            'lacking_hours' => 200,
        ])->assertStatus(200);
        $this->postJson("/api/supervisor/promissory/{$id}/review", [
            'action' => 'approve',
            'lacking_hours' => 200,
        ])->assertStatus(422);
    }

    public function test_approved_short_student_becomes_eligible_and_releasable(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->pastAssignment($recipient, $supervisor);

        Sanctum::actingAs($recipient);
        Storage::fake('public');
        $id = $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))
            ->assertStatus(201)->json('data.id');

        // Short and unapproved: not eligible.
        Sanctum::actingAs($admin = $this->makeUser('admin'));
        $this->getJson('/api/admin/stipend/eligible')->assertStatus(200)
            ->assertJsonMissing(['user_id' => $recipient->id]);

        Sanctum::actingAs($supervisor);
        $this->postJson("/api/supervisor/promissory/{$id}/review", [
            'action' => 'approve',
            'lacking_hours' => 200,
        ])->assertStatus(200);

        // Approved: eligible with the promissory flag…
        Sanctum::actingAs($admin);
        $this->getJson('/api/admin/stipend/eligible')->assertStatus(200)
            ->assertJsonFragment(['user_id' => $recipient->id, 'via_promissory' => true]);

        // …and releasable, with the override recorded on the row.
        $token = $this->postJson('/api/admin/stipend/unlock', ['password' => self::PW])
            ->assertStatus(200)->json('data.unlock_token');
        $this->postJson('/api/admin/stipend/release-bulk', [
            'unlock_token' => $token,
            'items' => [[
                'user_id' => $recipient->id,
                'academic_year' => '2024-2025',
                'semester' => '1st Semester',
            ]],
        ])->assertStatus(200)->assertJsonPath('data.released.0.status', 'certified');

        $this->assertStringContainsString(
            "via approved promissory #{$id}",
            \App\Models\StipendHistory::firstWhere('user_id', $recipient->id)->remarks
        );
    }

    public function test_admin_can_list_all_promissory_notes(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->pastAssignment($recipient, $supervisor);

        Sanctum::actingAs($recipient);
        Storage::fake('public');
        $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))->assertStatus(201);

        Sanctum::actingAs($this->makeUser('admin'));
        $this->getJson('/api/admin/promissory')->assertStatus(200)
            ->assertJsonFragment(['assignment_id' => $assignment->id]);
    }
}
