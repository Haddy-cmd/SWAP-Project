<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Assignment;
use App\Models\PromissoryNote;
use App\Models\StudentProfile;
use App\Models\TermEvaluation;
use App\Models\TermReport;
use App\Models\TestingChange;
use App\Models\TimeLog;
use App\Models\User;
use App\Services\TestingService;
use App\Support\TestTools;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin → System Testing: picked existing accounts, shortcuts and their undo, bypasses for picked accounts only. */
class TestingToolsTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('filesystems.documents_disk', 'public'));
        TestTools::setEnabled(true);
        $this->admin = $this->makeUser('admin', ['position_title' => 'Director']);
    }

    /** @return array{0: User, 1: Assignment} a real recipient with 3 verified hours and a failing evaluation */
    private function realRecipient(?User $supervisor = null): array
    {
        $student = $this->makeUser('recipient');
        StudentProfile::create([
            'user_id' => $student->id, 'student_id_number' => '202155555', 'first_name' => 'Real', 'last_name' => 'Student',
            'college' => 'CICS', 'program' => 'BSIT', 'year_level' => 3,
        ]);
        $supervisor ??= $this->makeSupervisorWithoutSelfie();
        $assignment = $this->makeAssignment($student, $supervisor, null, [
            'academic_year' => '2026-2027', 'semester' => '1st Semester', 'required_hours' => 20,
            'start_date' => '2026-08-01', 'end_date' => '2026-12-15',
        ]);
        $this->makeClosedLog($assignment, 3);
        TermEvaluation::create(['assignment_id' => $assignment->id, 'evaluator_id' => $supervisor->id, 'rating' => 2, 'remarks' => 'Original.', 'passed' => false]);

        return [$student, $assignment];
    }

    private function pick(User $user)
    {
        Sanctum::actingAs($this->admin);

        return $this->postJson("/api/admin/testing/accounts/{$user->id}");
    }

    private function release(User $user, bool $undo)
    {
        Sanctum::actingAs($this->admin);

        return $this->deleteJson("/api/admin/testing/accounts/{$user->id}", ['undo' => $undo]);
    }

    private function act(User $recipient, string $action, array $data = [])
    {
        Sanctum::actingAs($this->admin);

        return $this->postJson("/api/admin/testing/recipients/{$recipient->id}/{$action}", $data);
    }

    public function test_admins_switch_it_on_and_off_from_the_page(): void
    {
        TestTools::setEnabled(false);
        Sanctum::actingAs($this->admin);

        $this->putJson('/api/admin/testing/switch', ['enabled' => true])->assertOk()
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('message', 'System Testing is on.');
        $this->assertTrue(TestTools::enabled());
        $this->assertDatabaseHas('audit_logs', ['action' => 'testing_switched_on', 'user_id' => $this->admin->id]);

        $this->putJson('/api/admin/testing/switch', ['enabled' => false])->assertOk()->assertJsonPath('data.enabled', false);
        TestTools::flush();
        $this->assertFalse(TestTools::enabled());
        $this->assertDatabaseHas('audit_logs', ['action' => 'testing_switched_off', 'user_id' => $this->admin->id]);

        foreach (['supervisor', 'recipient'] as $role) {
            Sanctum::actingAs($this->makeUser($role));
            $this->putJson('/api/admin/testing/switch', ['enabled' => true])->assertStatus(403);
            $this->getJson('/api/admin/testing')->assertStatus(403);
        }
        TestTools::flush();
        $this->assertFalse(TestTools::enabled());
    }

    public function test_while_off_the_page_shows_but_only_removing_works(): void
    {
        [$student] = $this->realRecipient();
        $this->pick($student)->assertOk();
        TestTools::setEnabled(false);

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/admin/testing')->assertOk()
            ->assertJsonPath('data.enabled', false)
            ->assertJsonCount(1, 'data.accounts');
        $this->pick($this->makeUser('recipient'))->assertStatus(409)->assertJsonPath('message', TestTools::MSG_OFF);
        $this->act($student, 'end-term')->assertStatus(409)->assertJsonPath('message', TestTools::MSG_OFF);
        $this->assertFalse(TestTools::bypasses($student->fresh()));

        Sanctum::actingAs($this->admin);
        $this->deleteJson('/api/admin/testing')->assertOk()
            ->assertJsonPath('message', '1 account removed from System Testing; its changes were undone.');
        $this->assertNull($student->fresh()->testing_added_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'testing_released_all', 'user_id' => $this->admin->id]);
    }

    public function test_a_picked_account_gets_the_shortcuts_and_undo_puts_it_back(): void
    {
        [$student, $assignment] = $this->realRecipient();
        $original = $assignment->fresh();

        $this->pick($student)->assertOk()->assertJsonPath('message', "{$student->name} was added to System Testing.");
        $student->refresh();
        $this->assertNotNull($student->testing_added_at);
        $this->assertTrue(TestTools::bypasses($student));
        $this->assertDatabaseHas('audit_logs', ['action' => 'testing_account_added', 'user_id' => $this->admin->id]);

        // It stays a normal account: real email, counted in analytics.
        $this->assertSame($student->email, $student->routeNotificationFor('mail'));
        $this->getJson('/api/admin/analytics/overview?academic_year=2026-2027&semester=1st%20Semester')
            ->assertJsonPath('data.active_recipients', 1);

        $this->act($student, 'hours', ['hours' => 5, 'status' => 'verified'])->assertOk();
        $this->act($student, 'end-term')->assertOk();
        $this->act($student, 'close-term')->assertOk()->assertJsonPath('message', 'Term closed: deficient.');
        $this->act($student, 'term-report')->assertOk();
        $this->act($student, 'evaluation', ['rating' => 5])->assertOk();
        $this->act($student, 'renewal')->assertOk();
        $renewal = Application::where('user_id', $student->id)->where('type', 'renewal')->firstOrFail();
        $disk = Storage::disk(config('filesystems.documents_disk', 'public'));
        $this->assertNotEmpty($disk->files("documents/{$renewal->id}"));
        $this->assertEquals(8.0, $assignment->fresh()->verified_hours);

        $row = collect($this->getJson('/api/admin/testing')->assertOk()->json('data.accounts'))->firstWhere('id', $student->id);
        $this->assertGreaterThan(0, $row['changes']);

        // Removing works with the switch off too.
        TestTools::setEnabled(false);
        $this->release($student, true)->assertOk()
            ->assertJsonPath('message', "Removed from System Testing. {$row['changes']} changes undone.");

        $after = $assignment->fresh();
        $this->assertSame($original->end_date->toDateString(), $after->end_date->toDateString());
        $this->assertSame($original->start_date->toDateString(), $after->start_date->toDateString());
        $this->assertNull($after->term_status);
        $this->assertNull($after->deficient_hours);
        $this->assertEquals(3.0, $after->verified_hours);
        $this->assertSame(1, TimeLog::where('assignment_id', $assignment->id)->count());
        $this->assertNull(TermReport::where('assignment_id', $assignment->id)->first());
        $evaluation = TermEvaluation::where('assignment_id', $assignment->id)->firstOrFail();
        $this->assertSame(2, $evaluation->rating);
        $this->assertSame('Original.', $evaluation->remarks);
        $this->assertFalse($evaluation->passed);
        $this->assertNull(Application::find($renewal->id));
        $this->assertEmpty($disk->files("documents/{$renewal->id}"));
        $this->assertSame(0, TestingChange::where('user_id', $student->id)->count());
        $this->assertNull($student->fresh()->testing_added_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'testing_account_removed', 'user_id' => $this->admin->id]);
    }

    public function test_shortcuts_walk_a_short_term_through_promissory_and_renewal(): void
    {
        $supervisor = $this->makeSupervisorWithoutSelfie();
        [$student, $assignment] = $this->realRecipient($supervisor);
        $this->pick($student)->assertOk();

        $this->act($student, 'hours', ['hours' => 5, 'status' => 'verified'])->assertOk()
            ->assertJsonPath('message', 'Added 5 verified hours.');
        $this->assertEquals(8.0, $assignment->fresh()->verified_hours);

        // Too early for a promissory note — until the term is ended now.
        Sanctum::actingAs($student);
        $file = fn () => UploadedFile::fake()->create('note.pdf', 20, 'application/pdf');
        $this->post('/api/recipient/promissory', ['assignment_id' => $assignment->id, 'reason' => 'Testing the flow quickly.', 'file' => $file()], ['Accept' => 'application/json'])
            ->assertStatus(422);
        $this->act($student, 'end-term')->assertOk();
        Sanctum::actingAs($student);
        $noteId = $this->post('/api/recipient/promissory', ['assignment_id' => $assignment->id, 'reason' => 'Testing the flow quickly.', 'file' => $file()], ['Accept' => 'application/json'])
            ->assertStatus(201)->json('data.id');

        $this->act($student, 'makeup-overdue')->assertStatus(422)->assertJsonPath('message', TestingService::MSG_NO_NOTE);
        Sanctum::actingAs($supervisor);
        $this->postJson("/api/supervisor/promissory/{$noteId}/review", ['action' => 'approve', 'lacking_hours' => 12])->assertOk();

        $this->act($student, 'close-term')->assertOk()->assertJsonPath('message', 'Term closed: deficient.');
        $deadline = PromissoryNote::find($noteId)->makeup_deadline;
        $this->act($student, 'makeup-overdue')->assertOk();
        $this->assertTrue(PromissoryNote::find($noteId)->makeup_deadline->isPast());

        $this->act($student, 'term-report')->assertOk();
        $this->act($student, 'evaluation', ['rating' => 4])->assertOk()->assertJsonPath('message', 'Evaluated 4/5.');
        $this->act($student, 'renewal')->assertOk();
        $renewal = Application::where('user_id', $student->id)->where('type', 'renewal')->firstOrFail();
        $this->assertSame(1, $renewal->documents()->where('document_type', 'cor')->count());
        $this->act($student, 'renewal')->assertStatus(422);

        // The real renewal gate still applies: the overdue makeup blocks approval.
        Sanctum::actingAs($this->admin);
        $this->putJson("/api/admin/applications/{$renewal->id}/decide", ['decision' => 'approved', 'remarks' => 'Test.'])
            ->assertStatus(409);

        $this->act($student, 'reset-term')->assertOk();
        $this->assertNull($assignment->fresh()->term_status);

        // Undo puts the makeup deadline back; the note itself was filed on the normal page and stays.
        $this->release($student, true)->assertOk();
        $note = PromissoryNote::find($noteId);
        $this->assertNotNull($note);
        $this->assertSame($deadline->toDateString(), $note->makeup_deadline->toDateString());
    }

    public function test_bypasses_apply_to_picked_accounts_only(): void
    {
        // The picked recipient's supervisor requires a selfie; the office has no location.
        [$student, $assignment] = $this->realRecipient($this->makeUser('supervisor', ['require_clock_in_selfie' => true]));
        $this->pick($student)->assertOk();
        // Sunday, 10 PM in Manila — outside the clock-in window.
        $this->travelTo(Carbon::parse('2026-10-04 22:00', 'Asia/Manila'));

        // Far from anywhere, no selfie: allowed for the picked account.
        Sanctum::actingAs($student->fresh());
        $this->postJson('/api/recipient/attendance/time-in-geofence', [
            'qr_token' => $this->qrForOffice($assignment->office), 'latitude' => 14.6, 'longitude' => 121.0, 'accuracy' => 20,
        ])->assertStatus(201);

        // A recipient who isn't picked is still refused at the same moment.
        $real = $this->makeUser('recipient');
        $realOffice = $this->makeGeofencedOffice();
        $this->makeAssignment($real, $this->makeSupervisorWithoutSelfie(), $realOffice);
        Sanctum::actingAs($real);
        $this->postJson('/api/recipient/attendance/time-in-geofence', [
            'qr_token' => $this->qrForOffice($realOffice), 'latitude' => 8.0, 'longitude' => 124.0, 'accuracy' => 10,
        ])->assertStatus(422)->assertJsonPath('message', 'Clock-in is only available Monday to Saturday.');

        // Interviews: any time (even past) for a picked applicant, the real windows for others.
        $applicant = $this->makeUser('applicant');
        $pickedApp = Application::create(['user_id' => $applicant->id, 'academic_year' => '2026-2027', 'semester' => '1st Semester', 'status' => 'submitted']);
        $this->pick($applicant)->assertOk();
        $other = $this->makeUser('applicant');
        $otherApp = Application::create(['user_id' => $other->id, 'academic_year' => '2026-2027', 'semester' => '1st Semester', 'status' => 'submitted']);
        Sanctum::actingAs($this->admin);
        $slot = ['scheduled_at' => '2026-10-03T23:00:00+08:00', 'mode' => 'in_person', 'location' => 'DSA'];
        $this->postJson("/api/admin/applications/{$pickedApp->id}/interview", $slot)->assertSuccessful();
        $this->postJson("/api/admin/applications/{$otherApp->id}/interview", $slot)->assertStatus(422);

        // Switched off, the picked account follows the real rules too.
        TestTools::setEnabled(false);
        $this->assertFalse(TestTools::bypasses($student->fresh()));
    }

    public function test_keeping_changes_and_decided_renewals_stay(): void
    {
        [$student, $assignment] = $this->realRecipient();

        // A renewal decided in the meantime is kept; the rest is undone.
        $this->pick($student)->assertOk();
        $this->act($student, 'hours', ['hours' => 2, 'status' => 'verified'])->assertOk();
        $this->act($student, 'renewal')->assertOk();
        $renewal = Application::where('user_id', $student->id)->where('type', 'renewal')->firstOrFail();
        $renewal->update(['status' => 'rejected']);
        $this->release($student, true)->assertOk()
            ->assertJsonPath('kept.0', "Renewal for {$renewal->semester} {$renewal->academic_year} was already rejected, so it was kept.");
        $this->assertNotNull(Application::find($renewal->id));
        $this->assertSame(1, TimeLog::where('assignment_id', $assignment->id)->count());

        // "Keep changes": the record stays as it is, the journal is cleared.
        $this->pick($student)->assertOk();
        $this->act($student, 'hours', ['hours' => 2, 'status' => 'verified'])->assertOk();
        $this->release($student, false)->assertOk()->assertJsonPath('message', 'Removed from System Testing. The changes were kept.');
        $this->assertSame(2, TimeLog::where('assignment_id', $assignment->id)->count());
        $this->assertSame(0, TestingChange::where('user_id', $student->id)->count());
        $this->release($student, true)->assertStatus(404);
    }

    public function test_only_active_students_can_be_picked_and_found(): void
    {
        [$student] = $this->realRecipient();
        $inactive = $this->makeUser('recipient', ['is_active' => false]);

        $this->pick($this->makeUser('supervisor'))->assertStatus(422)->assertJsonPath('message', TestingService::MSG_NOT_STUDENT);
        $this->pick($this->admin)->assertStatus(422)->assertJsonPath('message', TestingService::MSG_NOT_STUDENT);
        $this->pick($inactive)->assertStatus(422)->assertJsonPath('message', TestingService::MSG_INACTIVE);

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/admin/testing/candidates?search=2021555')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $student->id)
            ->assertJsonPath('data.0.term', '1st Semester 2026-2027');
        $this->getJson('/api/admin/testing/candidates?search=Supervisor')->assertOk()->assertJsonCount(0, 'data');

        $this->pick($student)->assertOk();
        $this->pick($student)->assertStatus(422)->assertJsonPath('message', TestingService::MSG_ALREADY);
        $this->getJson('/api/admin/testing/candidates?search=2021555')->assertOk()->assertJsonCount(0, 'data');

        Sanctum::actingAs($student);
        $this->getJson('/api/admin/testing/candidates?search=2021555')->assertStatus(403);
        $this->postJson("/api/admin/testing/accounts/{$student->id}")->assertStatus(403);
        $this->deleteJson("/api/admin/testing/accounts/{$student->id}", ['undo' => true])->assertStatus(403);
        $this->deleteJson('/api/admin/testing')->assertStatus(403);
    }

    public function test_remove_all_undoes_and_releases_every_picked_account(): void
    {
        [$student, $assignment] = $this->realRecipient();
        $applicant = $this->makeUser('applicant');
        $this->pick($student)->assertOk();
        $this->pick($applicant)->assertOk();
        $this->act($student, 'hours', ['hours' => 4, 'status' => 'verified'])->assertOk();

        Sanctum::actingAs($this->admin);
        $this->deleteJson('/api/admin/testing')->assertOk()
            ->assertJsonPath('message', '2 accounts removed from System Testing; their changes were undone.')
            ->assertJsonCount(0, 'data.accounts');

        $this->assertNotNull($student->fresh());
        $this->assertNull($student->fresh()->testing_added_at);
        $this->assertNull($applicant->fresh()->testing_added_at);
        $this->assertSame(1, TimeLog::where('assignment_id', $assignment->id)->count());
        $this->assertSame(0, TestingChange::count());
    }

    public function test_users_cannot_put_themselves_in_testing(): void
    {
        $student = $this->makeUser('recipient');
        Sanctum::actingAs($student);
        $this->putJson('/api/profile', ['name' => 'Sneaky', 'testing_added_at' => now()->toDateTimeString()])->assertOk();
        $this->assertNull($student->fresh()->testing_added_at);
    }

    public function test_complete_hours_logs_exactly_what_is_missing(): void
    {
        [$student, $assignment] = $this->realRecipient();
        $this->pick($student)->assertOk();

        $this->act($student, 'complete-hours')->assertOk()
            ->assertJsonPath('message', 'Added 17 verified hours over 3 days. Hours are now complete.');
        $this->assertEquals(20.0, $assignment->fresh()->verified_hours);
        $added = TimeLog::where('assignment_id', $assignment->id)->orderBy('id')->get()->slice(1);
        $this->assertCount(3, $added);
        foreach ($added as $log) {
            $this->assertSame('verified', $log->status);
            $this->assertLessThanOrEqual(8.0, (float) $log->duration_hours);
            $this->assertFalse(Carbon::parse($log->date)->isSunday());
        }
        $this->assertContains($student->id, array_column(app(\App\Services\StipendService::class)->eligibleRecipients(), 'user_id'));

        $this->act($student, 'complete-hours')->assertStatus(422)->assertJsonPath('message', TestingService::MSG_HOURS_DONE);
        $this->act($student, 'clock-in')->assertStatus(422)->assertJsonPath('message', TestingService::MSG_HOURS_DONE);

        $this->release($student, true)->assertOk();
        $this->assertEquals(3.0, $assignment->fresh()->verified_hours);
        $this->assertSame(1, TimeLog::where('assignment_id', $assignment->id)->count());
    }

    public function test_file_promissory_note_goes_through_the_real_rules(): void
    {
        $supervisor = $this->makeSupervisorWithoutSelfie();
        [$student, $assignment] = $this->realRecipient($supervisor);
        $this->pick($student)->assertOk();

        // Before the term ends, the real rule refuses it.
        $this->act($student, 'file-promissory')->assertStatus(422)
            ->assertJsonPath('message', 'Promissory notes can only be submitted after the semester ends.');

        $this->act($student, 'end-term')->assertOk();
        $this->act($student, 'file-promissory')->assertOk()->assertJsonPath('message', 'Promissory note filed. Their supervisor can review it now.');
        $note = PromissoryNote::where('assignment_id', $assignment->id)->firstOrFail();
        $this->assertSame(PromissoryNote::STATUS_PENDING, $note->status);
        $this->assertEquals(17.0, (float) $note->lacking_hours);
        $disk = Storage::disk(config('filesystems.documents_disk', 'public'));
        $this->assertTrue($disk->exists($note->file_path));
        $this->act($student, 'file-promissory')->assertStatus(422)
            ->assertJsonPath('message', 'There is already a pending promissory note for this assignment.');
        Sanctum::actingAs($this->admin);
        $this->assertSame('pending', collect($this->getJson('/api/admin/testing')->json('data.accounts.0.assignments'))->first()['promissory']);

        // Reviewed on the supervisor's own page, then undone with the rest.
        Sanctum::actingAs($supervisor);
        $this->postJson("/api/supervisor/promissory/{$note->id}/review", ['action' => 'approve', 'lacking_hours' => 17])->assertOk();
        $this->release($student, true)->assertOk();
        $this->assertNull(PromissoryNote::find($note->id));
        $this->assertFalse($disk->exists($note->file_path));

        // Kept once a renewal was approved with it (the term is no longer active).
        $this->pick($student)->assertOk();
        $this->act($student, 'end-term')->assertOk();
        $this->act($student, 'file-promissory')->assertOk();
        $kept = PromissoryNote::where('assignment_id', $assignment->id)->firstOrFail();
        $assignment->update(['status' => 'completed']);
        $this->release($student, true)->assertOk()
            ->assertJsonPath('kept.0', 'The promissory note for 1st Semester 2026-2027 was kept: a renewal was already approved with it.');
        $this->assertNotNull(PromissoryNote::find($kept->id));
    }

    public function test_clock_in_now_and_auto_clock_out(): void
    {
        [$student, $assignment] = $this->realRecipient();
        $this->pick($student)->assertOk();

        $this->act($student, 'auto-clock-out')->assertStatus(422)->assertJsonPath('message', TestingService::MSG_NOT_CLOCKED_IN);
        $this->act($student, 'clock-in')->assertOk()
            ->assertJsonPath('message', 'Clocked in now. The student can clock out by scanning their office QR.')
            ->assertJsonPath('data.accounts.0.clocked_in_since', fn ($v) => $v !== null);
        $log = TimeLog::where('user_id', $student->id)->where('status', 'open')->firstOrFail();
        $this->act($student, 'clock-in')->assertStatus(422)->assertJsonPath('message', TestingService::MSG_CLOCKED_IN);

        $this->act($student, 'auto-clock-out')->assertOk()
            ->assertJsonPath('message', "Clocked out automatically, as the 12-hour safety net does. The log now waits for the supervisor's review.")
            ->assertJsonPath('data.accounts.0.clocked_in_since', null);
        $log->refresh();
        $this->assertSame('pending_verification', $log->status);
        $this->assertSame('auto_stale', $log->clocked_out_reason);
        $this->act($student, 'auto-clock-out')->assertStatus(422);

        $this->release($student, true)->assertOk();
        $this->assertNull(TimeLog::find($log->id));

        // A shift the student opened themselves is closed by the button and reopened by undo.
        $own = $this->makeOpenLog($assignment, $student);
        $this->pick($student)->assertOk();
        $this->act($student, 'auto-clock-out')->assertOk();
        $this->assertSame('pending_verification', $own->fresh()->status);
        $this->release($student, true)->assertOk();
        $own->refresh();
        $this->assertSame('open', $own->status);
        $this->assertNull($own->time_out);
        $this->assertNull($own->clocked_out_reason);

        // Like every shortcut, the new ones need the switch on.
        $this->pick($student)->assertOk();
        TestTools::setEnabled(false);
        foreach (['complete-hours', 'clock-in', 'auto-clock-out', 'file-promissory'] as $action) {
            $this->act($student, $action)->assertStatus(409);
        }
    }
}
