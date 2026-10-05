<?php

namespace Tests\Feature;

use App\Models\PromissoryNote;
use App\Models\SemesterPeriod;
use App\Models\StipendHistory;
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

    /**
     * An assignment whose semester already ended (Manila, yesterday), with some
     * verified service (a note covers a shortfall, not a term with no service).
     */
    private function pastAssignment($recipient, $supervisor, array $attrs = [], float $verifiedHours = 5)
    {
        $assignment = $this->makeAssignment($recipient, $supervisor, null, array_merge([
            'required_hours' => 200,
            'start_date' => Carbon::now('Asia/Manila')->subMonths(5)->toDateString(),
            'end_date' => Carbon::now('Asia/Manila')->subDay()->toDateString(),
        ], $attrs));

        if ($verifiedHours > 0) {
            $this->makeClosedLog($assignment, $verifiedHours);
        }

        return $assignment;
    }

    /** The DSA semester period for the test assignments' term. */
    private function period(string $start, string $end): SemesterPeriod
    {
        return SemesterPeriod::create([
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'start_date' => $start,
            'end_date' => $end,
        ]);
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
        $this->assertEquals(195.0, (float) $note->lacking_hours);
        $this->assertEquals(5.0, (float) $note->verified_hours_snapshot);
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

    public function test_the_document_alone_is_enough_and_met_hours_say_why_no_note_is_needed(): void
    {
        Storage::fake('public');
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->pastAssignment($recipient, $supervisor);

        // No separate reason: the uploaded note carries the explanation.
        Sanctum::actingAs($recipient);
        $payload = $this->submitPayload($assignment->id);
        unset($payload['reason']);
        $this->post('/api/recipient/promissory', $payload, ['Accept' => 'application/json'])->assertStatus(201);
        $this->assertNull(PromissoryNote::where('assignment_id', $assignment->id)->firstOrFail()->reason);

        // Hours already met: the form and the API both say why there's nothing to file.
        $done = $this->pastAssignment($this->makeUser('recipient'), $supervisor, ['required_hours' => 4]);
        Sanctum::actingAs($done->user);
        $message = 'No lacking hours: 5 of 4 required hours are verified, so a promissory note isn\'t needed.';
        $this->getJson('/api/recipient/promissory')->assertOk()
            ->assertJsonPath('data.submission.can_submit', false)
            ->assertJsonPath('data.submission.reason', $message);
        $this->post('/api/recipient/promissory', $this->submitPayload($done->id), ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('message', $message);
    }

    public function test_submit_with_zero_verified_hours_is_rejected(): void
    {
        Storage::fake('public');
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->pastAssignment($recipient, $supervisor, [], verifiedHours: 0);

        Sanctum::actingAs($recipient);
        $message = 'A promissory note needs some verified service hours. You have none for 1st Semester 2024-2025.';
        $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))
            ->assertStatus(422)->assertJsonPath('message', $message);
        $this->getJson('/api/recipient/promissory')->assertStatus(200)
            ->assertJsonPath('data.submission.can_submit', false)
            ->assertJsonPath('data.submission.reason', $message);

        $this->assertDatabaseMissing('promissory_notes', ['assignment_id' => $assignment->id]);
    }

    public function test_semester_end_comes_from_the_semester_period(): void
    {
        Storage::fake('public');
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        // No end date of its own: the term follows its semester period.
        $assignment = $this->pastAssignment($recipient, $supervisor, ['end_date' => null]);

        Sanctum::actingAs($recipient);
        $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))
            ->assertStatus(422)
            ->assertJsonPath('message', "The semester period for 1st Semester 2024-2025 isn't set up yet. Ask the DSA to add it under Semesters.");

        // The period hasn't ended yet: too early.
        $period = $this->period(
            Carbon::now('Asia/Manila')->subMonths(4)->toDateString(),
            Carbon::now('Asia/Manila')->addWeek()->toDateString(),
        );
        $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))->assertStatus(422);

        // Ended yesterday: the note is accepted.
        $period->update(['end_date' => Carbon::now('Asia/Manila')->subDay()->toDateString()]);
        $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))->assertStatus(201);
    }

    public function test_submit_with_completed_hours_is_rejected(): void
    {
        Storage::fake('public');
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->pastAssignment($recipient, $supervisor, ['required_hours' => 3], verifiedHours: 0);
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

    public function test_approve_sets_lacking_hours_and_no_makeup_deadline(): void
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
            'lacking_hours' => 195,
        ])->assertStatus(200)->assertJsonPath('data.status', 'approved');

        // No makeup deadline: if the student renews, the lacking hours go to the next term.
        $note = PromissoryNote::find($id);
        $this->assertEquals(195.0, (float) $note->lacking_hours);
        $this->assertNull($note->makeup_deadline);
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
            'lacking_hours' => 195,
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
            'lacking_hours' => 195,
        ])->assertStatus(200);
        $this->postJson("/api/supervisor/promissory/{$id}/review", [
            'action' => 'approve',
            'lacking_hours' => 195,
        ])->assertStatus(422);
    }

    public function test_approved_short_student_becomes_eligible_and_releasable(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->pastAssignment($recipient, $supervisor);
        $this->submitTermReport($assignment);

        Sanctum::actingAs($recipient);
        $id = $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))
            ->assertStatus(201)->json('data.id');

        // Short and unapproved: not eligible.
        Sanctum::actingAs($admin = $this->makeUser('admin'));
        $this->getJson('/api/admin/stipend/eligible')->assertStatus(200)
            ->assertJsonMissing(['user_id' => $recipient->id]);

        Sanctum::actingAs($supervisor);
        $this->postJson("/api/supervisor/promissory/{$id}/review", [
            'action' => 'approve',
            'lacking_hours' => 195,
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
        ])->assertStatus(200)->assertJsonPath('data.released.0.status', 'released');

        $stub = StipendHistory::firstWhere('user_id', $recipient->id);
        $this->assertStringContainsString("via approved promissory #{$id}", $stub->remarks);

        // The shortfall is stored on the paid record itself…
        $this->assertTrue($stub->via_promissory);
        $this->assertSame($id, $stub->promissory_note_id);
        $this->assertEquals(200.0, (float) $stub->required_hours);
        $this->assertEquals(195.0, (float) $stub->deficient_hours);
        $this->assertEquals(195.0, (float) $stub->lacking_hours);
        $this->assertNull($stub->makeup_deadline);
        $this->assertEquals(195.0, (float) PromissoryNote::find($id)->deficient_hours);

        // …and printed on every part of the stub.
        $html = $this->slipHtml($stub);
        $this->assertStringContainsString('has rendered <b>5</b> of the <b>200</b>', $html);
        $this->assertStringContainsString('with a deficiency of <b>195 hours</b>', $html);
        $this->assertStringContainsString("covered by approved promissory note #{$id}", $html);
        $this->assertSame(2, substr_count($html, 'Deficiency: <b>195 hrs</b>'));
        $this->assertStringNotContainsString('has completed the duty hours', $html);

        $this->getJson("/api/admin/stipend")->assertOk()
            ->assertJsonFragment(['via_promissory' => true, 'deficient_hours' => 195]);
    }

    public function test_a_student_who_met_the_hours_after_an_approved_note_is_paid_normally(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->pastAssignment($recipient, $supervisor, ['required_hours' => 10]);
        $this->submitTermReport($assignment);

        Sanctum::actingAs($recipient);
        $id = $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))
            ->assertStatus(201)->json('data.id');
        Sanctum::actingAs($supervisor);
        $this->postJson("/api/supervisor/promissory/{$id}/review", ['action' => 'approve', 'lacking_hours' => 5])->assertOk();

        // The makeup is rendered before the release.
        $this->makeClosedLog($assignment, 5);

        $stub = $this->releaseFor($recipient);
        $this->assertFalse($stub->via_promissory);
        $this->assertNull($stub->promissory_note_id);
        $this->assertNull($stub->deficient_hours);
        $this->assertStringNotContainsString('promissory', (string) $stub->remarks);

        $html = $this->slipHtml($stub);
        $this->assertStringContainsString('has completed the duty hours required for', $html);
        $this->assertStringNotContainsString('Deficiency:', $html);
    }

    public function test_a_promissory_term_rolled_into_the_next_is_still_releasable(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->pastAssignment($recipient, $supervisor);
        $this->submitTermReport($assignment);

        Sanctum::actingAs($recipient);
        $id = $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))
            ->assertStatus(201)->json('data.id');
        Sanctum::actingAs($supervisor);
        $this->postJson("/api/supervisor/promissory/{$id}/review", ['action' => 'approve', 'lacking_hours' => 195])->assertOk();

        // A renewal moved the student on: the old term is completed, not active.
        $assignment->update(['status' => 'completed']);

        $stub = $this->releaseFor($recipient);
        $this->assertTrue($stub->via_promissory);
        $this->assertSame($id, $stub->promissory_note_id);

        // A suspended placement is not paid.
        $other = $this->makeUser('recipient');
        $suspended = $this->pastAssignment($other, $supervisor, ['required_hours' => 5, 'status' => 'suspended'], verifiedHours: 5);
        $this->submitTermReport($suspended);
        $this->getJson('/api/admin/stipend/eligible')->assertOk()->assertJsonMissing(['user_id' => $other->id]);
    }

    /** Release the recipient's 2024-2025 1st Semester stub through the bulk checklist. */
    private function releaseFor($recipient): StipendHistory
    {
        Sanctum::actingAs($admin = $this->makeUser('admin'));
        $token = $this->postJson('/api/admin/stipend/unlock', ['password' => self::PW])
            ->assertStatus(200)->json('data.unlock_token');
        $this->postJson('/api/admin/stipend/release-bulk', [
            'unlock_token' => $token,
            'items' => [['user_id' => $recipient->id, 'academic_year' => '2024-2025', 'semester' => '1st Semester']],
        ])->assertStatus(200)->assertJsonPath('data.released.0.status', 'released');

        return StipendHistory::where('user_id', $recipient->id)->latest('id')->firstOrFail();
    }

    /** The stub's HTML with whitespace collapsed, as the PDF lays it out. */
    private function slipHtml(StipendHistory $stub): string
    {
        return preg_replace('/\s+/', ' ', view('stipend.slip', [
            'stipend' => $stub->fresh()->load(['recipient.profile', 'signatures.user']),
            'claimQr' => null,
        ])->render());
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

    public function test_notes_stay_open_until_renewal_for_the_next_semester_closes(): void
    {
        Storage::fake('public');
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->pastAssignment($recipient, $supervisor); // ended yesterday
        $next = SemesterPeriod::create([
            'academic_year' => '2024-2025', 'semester' => '2nd Semester',
            'start_date' => Carbon::now('Asia/Manila')->addWeek()->toDateString(),
            'end_date' => Carbon::now('Asia/Manila')->addMonths(5)->toDateString(),
        ]);
        Sanctum::actingAs($recipient);

        // Renewal not opened yet, then open: notes can be filed, and the page says until when.
        $this->getJson('/api/recipient/promissory')->assertOk()
            ->assertJsonPath('data.submission.can_submit', true)
            ->assertJsonPath('data.submission.window_note', 'You can submit until renewal for 2nd Semester 2024-2025 closes.');
        Sanctum::actingAs($this->makeUser('admin'));
        $this->putJson("/api/admin/semester-periods/{$next->id}", [
            'academic_year' => '2024-2025', 'semester' => '2nd Semester', 'renewal_open' => true,
            'start_date' => $next->start_date->toDateString(), 'end_date' => $next->end_date->toDateString(),
        ])->assertOk();
        Sanctum::actingAs($recipient);
        $this->getJson('/api/recipient/promissory')->assertJsonPath('data.submission.can_submit', true);

        // Renewal closed: the window is over.
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);
        $this->putJson("/api/admin/semester-periods/{$next->id}", [
            'academic_year' => '2024-2025', 'semester' => '2nd Semester', 'renewal_open' => false,
            'start_date' => $next->start_date->toDateString(), 'end_date' => $next->end_date->toDateString(),
        ])->assertOk();
        $this->assertNotNull($next->fresh()->renewal_closed_at);

        $closed = 'Promissory notes for 1st Semester 2024-2025 closed when renewal for 2nd Semester 2024-2025 closed on '
            . Carbon::now('Asia/Manila')->format('M j, Y') . '.';
        Sanctum::actingAs($recipient);
        $this->getJson('/api/recipient/promissory')->assertOk()
            ->assertJsonPath('data.submission.can_submit', false)
            ->assertJsonPath('data.submission.reason', $closed);
        $this->postJson('/api/recipient/promissory', $this->submitPayload($assignment->id))
            ->assertStatus(422)->assertJsonPath('message', $closed);
    }
}
