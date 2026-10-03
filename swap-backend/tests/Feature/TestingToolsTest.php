<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\NarrativeReport;
use App\Models\PromissoryNote;
use App\Models\StipendHistory;
use App\Models\StipendSignature;
use App\Models\StudentProfile;
use App\Models\TermReport;
use App\Models\TestingSnapshot;
use App\Models\TimeLog;
use App\Models\User;
use App\Services\TestingService;
use App\Support\AccountSnapshot;
use App\Support\TestTools;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin → System Testing: picked existing accounts, shortcuts, bypasses for picked accounts only, and the restore when testing ends. */
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

    /** @return array{0: User, 1: Assignment} a real recipient with 3 verified hours */
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

        return [$student, $assignment];
    }

    private function pick(User $user)
    {
        Sanctum::actingAs($this->admin);

        return $this->postJson("/api/admin/testing/accounts/{$user->id}");
    }

    private function release(User $user)
    {
        Sanctum::actingAs($this->admin);

        return $this->deleteJson("/api/admin/testing/accounts/{$user->id}");
    }

    /** The student's whole record as raw rows, for "exactly as before" comparisons. */
    private function record(User $user): array
    {
        return json_decode(json_encode(app(AccountSnapshot::class)->current($user->id)), true);
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
            ->assertJsonPath('message', '1 account was restored to how it was when picked and removed from System Testing.');
        $this->assertNull($student->fresh()->testing_added_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'testing_released_all', 'user_id' => $this->admin->id]);
    }

    public function test_a_picked_account_gets_the_shortcuts_and_removing_it_restores_it(): void
    {
        [$student, $assignment] = $this->realRecipient();
        $original = $assignment->fresh();
        $before = $this->record($student);

        $this->pick($student)->assertOk()->assertJsonPath('message', "{$student->name} was added to System Testing.");
        $this->assertSame(1, TestingSnapshot::where('user_id', $student->id)->count());
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
        $this->act($student, 'review-report', ['eligible' => true])->assertOk()
            ->assertJsonPath('message', 'End-of-term report accepted by the supervisor: eligible for renewal.');
        $this->assertTrue(TermReport::where('assignment_id', $assignment->id)->firstOrFail()->renewal_eligible);
        $this->act($student, 'renewal')->assertOk();
        $renewal = Application::where('user_id', $student->id)->where('type', 'renewal')->firstOrFail();
        $disk = Storage::disk(config('filesystems.documents_disk', 'public'));
        $this->assertNotEmpty($disk->files("documents/{$renewal->id}"));
        $this->assertEquals(8.0, $assignment->fresh()->verified_hours);

        $row = collect($this->getJson('/api/admin/testing')->assertOk()->json('data.accounts'))->firstWhere('id', $student->id);
        $this->assertTrue($row['restorable']);
        $this->assertNotNull($row['picked_at']);

        // Removing works with the switch off too.
        TestTools::setEnabled(false);
        $this->release($student)->assertOk()
            ->assertJsonPath('message', 'Restored to how it was when picked and removed from System Testing.');
        $this->assertSame($before, $this->record($student));

        $after = $assignment->fresh();
        $this->assertSame($original->end_date->toDateString(), $after->end_date->toDateString());
        $this->assertSame($original->start_date->toDateString(), $after->start_date->toDateString());
        $this->assertNull($after->term_status);
        $this->assertNull($after->deficient_hours);
        $this->assertEquals(3.0, $after->verified_hours);
        $this->assertSame(1, TimeLog::where('assignment_id', $assignment->id)->count());
        $this->assertNull(TermReport::where('assignment_id', $assignment->id)->first());
        $this->assertNull(Application::find($renewal->id));
        $this->assertEmpty($disk->files("documents/{$renewal->id}"));
        $this->assertSame(0, TestingSnapshot::count());
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

        Sanctum::actingAs($supervisor);
        $this->postJson("/api/supervisor/promissory/{$noteId}/review", ['action' => 'approve', 'lacking_hours' => 12])->assertOk();

        $this->act($student, 'close-term')->assertOk()->assertJsonPath('message', 'Term closed: deficient.');
        $this->assertNull(PromissoryNote::find($noteId)->makeup_deadline);

        $this->act($student, 'term-report')->assertOk();
        $this->act($student, 'renewal')->assertOk();
        $renewal = Application::where('user_id', $student->id)->where('type', 'renewal')->firstOrFail();
        $this->assertSame(1, $renewal->documents()->where('document_type', 'cor')->count());
        $this->act($student, 'renewal')->assertStatus(422);

        // The real renewal gate: short on hours, the approved note and the report are enough,
        // and the 12 lacking hours move into the next term.
        Sanctum::actingAs($this->admin);
        $this->putJson("/api/admin/applications/{$renewal->id}/decide", ['decision' => 'approved', 'remarks' => 'Test.'])
            ->assertOk();
        $this->assertSame(20 + 12, Assignment::where('user_id', $student->id)->where('status', 'active')->firstOrFail()->required_hours);

        // The restore removes the note too, although the student filed it on the normal page.
        $this->release($student)->assertOk();
        $this->assertNull(PromissoryNote::find($noteId));
        $this->assertSame('active', $assignment->fresh()->status);
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

    public function test_switching_off_restores_a_renewal_approved_on_the_normal_page(): void
    {
        $supervisor = $this->makeSupervisorWithoutSelfie();
        [$student, $assignment] = $this->realRecipient($supervisor);
        $before = $this->record($student);
        $disk = Storage::disk(config('filesystems.documents_disk', 'public'));
        $this->pick($student)->assertOk();

        // The student files a promissory note on their own page; the supervisor approves it on theirs.
        $this->act($student, 'end-term')->assertOk();
        Sanctum::actingAs($student);
        $noteId = $this->post('/api/recipient/promissory', [
            'assignment_id' => $assignment->id, 'file' => UploadedFile::fake()->create('note.pdf', 20, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(201)->json('data.id');
        $notePath = PromissoryNote::findOrFail($noteId)->file_path;
        Sanctum::actingAs($supervisor);
        $this->postJson("/api/supervisor/promissory/{$noteId}/review", ['action' => 'approve', 'lacking_hours' => 17])->assertOk();

        // The term closes; the admin approves the renewal on Admin → Applications, moving the student to 2nd semester.
        $this->act($student, 'close-term')->assertOk();
        $this->act($student, 'term-report')->assertOk();
        $this->act($student, 'renewal')->assertOk();
        $renewal = Application::where('user_id', $student->id)->where('type', 'renewal')->firstOrFail();
        Sanctum::actingAs($this->admin);
        $this->putJson("/api/admin/applications/{$renewal->id}/decide", ['decision' => 'approved', 'remarks' => 'Test.'])->assertOk();
        $this->assertSame('completed', $assignment->fresh()->status);
        $this->assertSame('2nd Semester', Assignment::where('user_id', $student->id)->where('status', 'active')->firstOrFail()->semester);
        $this->assertGreaterThan(0, \Illuminate\Support\Facades\DB::table('notifications')->where('notifiable_id', $supervisor->id)->count());

        // Switching testing off puts everything back exactly as it was.
        $this->putJson('/api/admin/testing/switch', ['enabled' => false])->assertOk()
            ->assertJsonPath('message', 'System Testing is off. 1 account was restored to how it was when picked.');

        $this->assertSame($before, $this->record($student));
        $this->assertSame(['1st Semester'], Assignment::where('user_id', $student->id)->pluck('semester')->all());
        $this->assertSame('active', $assignment->fresh()->status);
        $this->assertNull(PromissoryNote::find($noteId));
        $this->assertNull(Application::find($renewal->id));
        $this->assertFalse($disk->exists($notePath));
        $this->assertEmpty($disk->allFiles("documents/{$renewal->id}"));
        // The bell entries from the test went too (the student's, and the supervisor's about the note).
        $this->assertSame(0, \Illuminate\Support\Facades\DB::table('notifications')->where('notifiable_id', $student->id)->count());
        $this->assertSame(0, \Illuminate\Support\Facades\DB::table('notifications')->where('notifiable_id', $supervisor->id)->count());
        $this->assertNull($student->fresh()->testing_added_at);
        $this->assertSame(0, TestingSnapshot::count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'testing_account_removed', 'auditable_id' => $student->id]);
    }

    public function test_the_original_record_comes_back_with_the_same_ids_after_resets(): void
    {
        [$student, $assignment] = $this->realRecipient();
        $this->addNarrative(TimeLog::where('assignment_id', $assignment->id)->firstOrFail());
        $this->makeClosedLog($assignment, 17);
        StipendHistory::create([
            'user_id' => $student->id, 'amount' => 5000, 'academic_year' => '2026-2027', 'semester' => '1st Semester',
            'status' => StipendHistory::STATUS_CLAIMED, 'control_number' => 'SWAP-STP-ORIGINAL', 'claimed_at' => now(),
        ]);
        $before = $this->record($student);

        $this->pick($student)->assertOk();
        $this->act($student, 'reset-stipend')->assertOk();
        $this->act($student, 'reset-hours')->assertOk();
        $this->act($student, 'complete-hours')->assertOk();
        $this->act($student, 'term-report')->assertOk();
        $this->act($student, 'review-report', ['eligible' => false])->assertOk();
        $this->act($student, 'end-term')->assertOk();
        $this->release($student)->assertOk();

        $this->assertSame($before, $this->record($student));
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
        $this->deleteJson("/api/admin/testing/accounts/{$student->id}")->assertStatus(403);
        $this->deleteJson('/api/admin/testing')->assertStatus(403);
    }

    public function test_restore_one_or_all_picked_accounts(): void
    {
        [$student, $assignment] = $this->realRecipient();
        $applicant = $this->makeUser('applicant');
        $this->pick($student)->assertOk();
        $this->pick($applicant)->assertOk();
        $this->act($student, 'hours', ['hours' => 4, 'status' => 'verified'])->assertOk();

        // Restoring one account leaves the other in testing, as it is.
        $this->release($applicant)->assertOk();
        $this->assertNotNull($student->fresh()->testing_added_at);
        $this->assertSame(2, TimeLog::where('assignment_id', $assignment->id)->count());
        $this->pick($applicant)->assertOk();

        Sanctum::actingAs($this->admin);
        $this->deleteJson('/api/admin/testing')->assertOk()
            ->assertJsonPath('message', '2 accounts were restored to how they were when picked and removed from System Testing.')
            ->assertJsonCount(0, 'data.accounts');

        $this->assertNotNull($student->fresh());
        $this->assertNull($student->fresh()->testing_added_at);
        $this->assertNull($applicant->fresh()->testing_added_at);
        $this->assertSame(1, TimeLog::where('assignment_id', $assignment->id)->count());
        $this->assertSame(0, TestingSnapshot::count());
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

        $this->release($student)->assertOk();
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

        // Reviewed on the supervisor's own page, then removed by the restore.
        Sanctum::actingAs($supervisor);
        $this->postJson("/api/supervisor/promissory/{$note->id}/review", ['action' => 'approve', 'lacking_hours' => 17])->assertOk();
        $this->release($student)->assertOk();
        $this->assertNull(PromissoryNote::find($note->id));
        $this->assertFalse($disk->exists($note->file_path));

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

        $this->release($student)->assertOk();
        $this->assertNull(TimeLog::find($log->id));

        // A shift the student opened themselves is closed by the button and reopened by the restore.
        $own = $this->makeOpenLog($assignment, $student);
        $this->pick($student)->assertOk();
        $this->act($student, 'auto-clock-out')->assertOk();
        $this->assertSame('pending_verification', $own->fresh()->status);
        $this->release($student)->assertOk();
        $own->refresh();
        $this->assertSame('open', $own->status);
        $this->assertNull($own->time_out);
        $this->assertNull($own->clocked_out_reason);

        // Like every shortcut, the new ones need the switch on.
        $this->pick($student)->assertOk();
        TestTools::setEnabled(false);
        foreach (['complete-hours', 'reset-hours', 'clock-in', 'auto-clock-out', 'file-promissory'] as $action) {
            $this->act($student, $action)->assertStatus(409);
        }
    }

    public function test_the_whole_flow_from_pending_hours_to_a_paid_stipend_and_back(): void
    {
        $supervisor = $this->makeSupervisorWithoutSelfie();
        [$student, $assignment] = $this->realRecipient($supervisor);
        $this->pick($student)->assertOk();

        // Hours: logged as pending, verified as the supervisor.
        $this->act($student, 'hours', ['hours' => 2, 'status' => 'pending_verification'])->assertOk();
        $this->act($student, 'verify-hours')->assertOk()
            ->assertJsonPath('message', "Verified 1 pending log (2 hours) as {$supervisor->name}.");
        $this->assertEquals(5.0, $assignment->fresh()->verified_hours);
        $this->act($student, 'verify-hours')->assertStatus(422)->assertJsonPath('message', TestingService::MSG_NO_PENDING_HOURS);

        // Promissory: filed after the term ends, approved as the supervisor.
        $this->act($student, 'end-term')->assertOk();
        $this->act($student, 'file-promissory')->assertOk();
        $this->act($student, 'approve-promissory')->assertOk();
        $note = PromissoryNote::where('assignment_id', $assignment->id)->firstOrFail();
        $this->assertSame(PromissoryNote::STATUS_APPROVED, $note->status);
        $this->assertEquals(15.0, (float) $note->lacking_hours);
        $this->assertSame($supervisor->id, $note->reviewed_by);
        $this->act($student, 'approve-promissory')->assertStatus(422)->assertJsonPath('message', TestingService::MSG_NO_PENDING_NOTE);

        // Stipend: the stub is released as the admin, then paid out as the Banking Office.
        $this->act($student, 'term-report')->assertOk();
        $this->act($student, 'release-stub')->assertOk();
        $stub = StipendHistory::where('user_id', $student->id)->firstOrFail();
        $this->assertSame(StipendHistory::STATUS_CERTIFIED, $stub->status);
        $this->assertTrue((bool) $stub->via_promissory);
        $this->act($student, 'pay-out')->assertOk()->assertJsonPath('message', "Paid out as the Banking Office: {$stub->control_number} is now received.");
        $this->assertSame(StipendHistory::STATUS_CLAIMED, $stub->fresh()->status);
        $this->assertSame(TestingService::TEST_RELEASING_OFFICER, $stub->fresh()->releasing_officer_name);
        $this->act($student, 'pay-out')->assertStatus(422);
        $this->assertSame('claimed', collect($this->getJson('/api/admin/testing')->json('data.accounts.0.assignments'))->first()['stipend']);

        // The restore walks it all back.
        $this->release($student)->assertOk();
        $this->assertNull(StipendHistory::find($stub->id));
        $this->assertSame(0, StipendSignature::where('stipend_history_id', $stub->id)->count());
        $this->assertNull(PromissoryNote::find($note->id));
        $this->assertSame(0, \App\Models\Verification::count());
        $this->assertEquals(3.0, $assignment->fresh()->verified_hours);
        $this->assertSame(1, TimeLog::where('assignment_id', $assignment->id)->count());
    }

    public function test_a_promissory_note_can_be_rejected_as_the_supervisor(): void
    {
        [$student, $assignment] = $this->realRecipient();
        $this->pick($student)->assertOk();
        $this->act($student, 'reject-promissory')->assertStatus(422)->assertJsonPath('message', TestingService::MSG_NO_PENDING_NOTE);

        $this->act($student, 'end-term')->assertOk();
        $this->act($student, 'file-promissory')->assertOk();
        $this->act($student, 'reject-promissory')->assertOk()->assertJsonPath('message', 'Promissory note rejected by the supervisor.');
        $this->assertSame(PromissoryNote::STATUS_REJECTED, PromissoryNote::where('assignment_id', $assignment->id)->firstOrFail()->status);
    }

    public function test_reset_stipend_makes_the_student_eligible_again_and_the_restore_brings_the_stub_back(): void
    {
        [$student, $assignment] = $this->realRecipient();
        $this->makeClosedLog($assignment, 17); // 20 of 20 hours: eligible once there's no stub
        $stub = StipendHistory::create([
            'user_id' => $student->id, 'amount' => 5000, 'academic_year' => '2026-2027', 'semester' => '1st Semester',
            'status' => StipendHistory::STATUS_CLAIMED, 'control_number' => 'SWAP-STP-TEST-1', 'claimed_at' => now(),
        ]);
        $signature = StipendSignature::create([
            'stipend_history_id' => $stub->id, 'signatory_role' => StipendSignature::ROLE_BENEFICIARY,
            'user_id' => $student->id, 'printed_name' => $student->name, 'method' => StipendSignature::METHOD_AUTHENTICATED, 'signed_at' => now(),
        ]);
        $eligible = fn () => array_column(app(\App\Services\StipendService::class)->eligibleRecipients(), 'user_id');
        $this->assertNotContains($student->id, $eligible());

        $this->pick($student)->assertOk();
        Sanctum::actingAs($this->admin);
        $this->assertSame('claimed', collect($this->getJson('/api/admin/testing')->json('data.accounts.0.assignments'))->first()['stipend']);

        $this->act($student, 'reset-stipend')->assertOk()
            ->assertJsonPath('message', 'Stipend reset for 1st Semester 2026-2027: the stub was removed, so the student is eligible again under Admin → Stipend. Undo on Remove from testing brings it back.');
        $this->assertNull(StipendHistory::find($stub->id));
        $this->assertNull(StipendSignature::find($signature->id));
        $this->assertContains($student->id, $eligible());
        $this->act($student, 'reset-stipend')->assertStatus(422)
            ->assertJsonPath('message', 'This recipient has no stipend stub for 1st Semester 2026-2027.');

        $this->release($student)->assertOk();
        $restored = StipendHistory::findOrFail($stub->id);
        $this->assertSame(StipendHistory::STATUS_CLAIMED, $restored->status);
        $this->assertSame('SWAP-STP-TEST-1', $restored->control_number);
        $this->assertSame($stub->id, StipendSignature::findOrFail($signature->id)->stipend_history_id);
        $this->assertNotContains($student->id, $eligible());
    }

    public function test_reset_hours_sets_the_term_back_to_zero_and_the_restore_brings_them_back(): void
    {
        [$student, $assignment] = $this->realRecipient();
        $log = TimeLog::where('assignment_id', $assignment->id)->firstOrFail();
        $narrative = $this->addNarrative($log);
        $this->pick($student)->assertOk();

        $this->act($student, 'reset-hours')->assertOk()
            ->assertJsonPath('message', 'Hours reset to 0: 1 time log (3 verified hours) set aside. Undo on Remove from testing brings them back.');
        $this->assertEquals(0.0, $assignment->fresh()->verified_hours);
        $this->assertSame(0, TimeLog::where('assignment_id', $assignment->id)->count());
        $this->assertNull(NarrativeReport::find($narrative->id));
        $this->act($student, 'reset-hours')->assertStatus(422)->assertJsonPath('message', TestingService::MSG_NO_HOURS);

        // Hours added after the reset go away; the real ones come back with their own IDs.
        $this->act($student, 'hours', ['hours' => 2, 'status' => 'verified'])->assertOk();
        $this->release($student)->assertOk();
        $this->assertSame([$log->id], TimeLog::where('assignment_id', $assignment->id)->pluck('id')->all());
        $this->assertEquals(3.0, $assignment->fresh()->verified_hours);
        $this->assertSame($log->id, NarrativeReport::findOrFail($narrative->id)->time_log_id);
    }

    public function test_an_account_tested_before_restore_points_is_cleaned_up_from_the_audit_log(): void
    {
        // Before the test: a 1st-semester placement with 3 hours.
        $this->travelTo(Carbon::parse('2026-10-02 09:00'));
        [$student, $first] = $this->realRecipient();

        // An earlier test (no snapshot): picked at 10:00, removed at 10:30 with the old undo.
        $this->travelTo(Carbon::parse('2026-10-02 10:00'));
        AuditLog::record('testing_account_added', $student, null, ['email' => $student->email], $this->admin->id);
        $this->travelTo(Carbon::parse('2026-10-02 10:10'));
        $this->makeClosedLog($first, 5);
        $first->update(['term_status' => Assignment::TERM_DEFICIENT, 'deficient_hours' => 12, 'term_status_at' => now(), 'status' => 'completed']);
        AuditLog::record('term_closed', $first, ['term_status' => null, 'deficient_hours' => null], ['term_status' => 'deficient'], null);
        PromissoryNote::create([
            'user_id' => $student->id, 'assignment_id' => $first->id, 'academic_year' => '2026-2027', 'semester' => '1st Semester',
            'file_path' => 'promissory/x.pdf', 'file_name' => 'x.pdf', 'mime_type' => 'application/pdf', 'file_size' => 100,
            'verified_hours_snapshot' => 8, 'lacking_hours' => 12, 'deficient_hours' => 12, 'status' => PromissoryNote::STATUS_APPROVED,
        ]);
        $renewal = Application::create(['user_id' => $student->id, 'academic_year' => '2026-2027', 'semester' => '2nd Semester', 'status' => 'approved', 'type' => 'renewal']);
        $second = $this->makeAssignment($student, $this->makeSupervisorWithoutSelfie(), null, ['academic_year' => '2026-2027', 'semester' => '2nd Semester']);
        $this->travelTo(Carbon::parse('2026-10-02 10:30'));
        AuditLog::record('testing_account_removed', $student, null, ['undo' => true, 'undone' => 0, 'kept' => []], $this->admin->id);

        // After the test: a real shift stays.
        $this->travelTo(Carbon::parse('2026-10-02 11:00'));
        $later = $this->makeClosedLog($first, 2);

        Sanctum::actingAs($this->admin);
        $listed = $this->getJson('/api/admin/testing/earlier')->assertOk()->json('data');
        $this->assertCount(1, $listed);
        $this->assertSame($student->id, $listed[0]['id']);
        foreach ([
            'Renewal for 2nd Semester 2026-2027 (approved)', 'Placement for 2nd Semester 2026-2027',
            'Promissory note for 1st Semester 2026-2027 (approved)', '1 time log',
            'Placement for 1st Semester 2026-2027 becomes active again', 'Result for 1st Semester 2026-2027 goes back to in progress',
        ] as $item) {
            $this->assertContains($item, $listed[0]['items']);
        }

        $this->postJson("/api/admin/testing/earlier/{$student->id}")->assertOk();

        $first->refresh();
        $this->assertSame('active', $first->status);
        $this->assertNull($first->term_status);
        $this->assertNull($first->term_status_at);
        $this->assertNull(Assignment::find($second->id));
        $this->assertNull(Application::find($renewal->id));
        $this->assertSame(0, PromissoryNote::count());
        $this->assertEqualsCanonicalizing([TimeLog::where('assignment_id', $first->id)->min('id'), $later->id], TimeLog::where('assignment_id', $first->id)->pluck('id')->all());
        $this->assertDatabaseHas('audit_logs', ['action' => 'testing_legacy_cleanup', 'auditable_id' => $student->id]);
        $this->getJson('/api/admin/testing/earlier')->assertOk()->assertJsonCount(0, 'data');
        $this->postJson("/api/admin/testing/earlier/{$student->id}")->assertStatus(422)
            ->assertJsonPath('message', TestingService::MSG_NOTHING_TO_CLEAN);
    }
}
