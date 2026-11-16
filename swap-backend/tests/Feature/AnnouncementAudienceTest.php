<?php

namespace Tests\Feature;

use App\Mail\AnnouncementMail;
use App\Notifications\AnnouncementNotification;
use App\Services\AnnouncementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin → Announcements → Send to: everyone, one office, recipients only, supervisors only. */
class AnnouncementAudienceTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private array $people;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        Mail::fake();
        $registrar = $this->makeOffice(['name' => 'Records Section']);
        $library = $this->makeOffice(['name' => 'Reading Room']);
        $regSup = $this->makeUser('supervisor', ['office_id' => $registrar->id]);
        $libSup = $this->makeUser('supervisor', ['office_id' => $library->id]);
        $atRegistrar = $this->makeUser('recipient');
        $this->makeAssignment($atRegistrar, $regSup, $registrar);
        $atLibrary = $this->makeUser('recipient');
        $this->makeAssignment($atLibrary, $libSup, $library);
        $waiting = $this->makeUser('recipient'); // approved, no office yet
        $this->people = compact('registrar', 'library', 'regSup', 'libSup', 'atRegistrar', 'atLibrary', 'waiting') + [
            'inactiveSup' => $this->makeUser('supervisor', ['office_id' => $registrar->id, 'is_active' => false]),
            'applicant' => $this->makeUser('applicant'),
            'admin' => $this->makeUser('admin'),
        ];
        Sanctum::actingAs($this->people['admin']);
    }

    private function send(array $extra)
    {
        return $this->postJson('/api/admin/announcements', [
            'title' => 'Office meeting', 'message' => 'Please come to the DSA office on Friday at 9 AM.',
        ] + $extra);
    }

    private function reached(array $who): void
    {
        $p = $this->people;
        $all = ['regSup', 'libSup', 'atRegistrar', 'atLibrary', 'waiting', 'inactiveSup', 'applicant', 'admin'];
        Notification::assertSentTo(array_map(fn ($k) => $p[$k], $who), AnnouncementNotification::class);
        Notification::assertNotSentTo(array_map(fn ($k) => $p[$k], array_diff($all, $who)), AnnouncementNotification::class);
    }

    public function test_one_office_reaches_its_students_and_supervisors(): void
    {
        $this->send(['audience' => 'office', 'office_id' => $this->people['registrar']->id])->assertStatus(201)
            ->assertJsonPath('data.recipient_count', 2)
            ->assertJsonPath('data.audience', 'office')
            ->assertJsonPath('data.audience_label', 'Records Section')
            ->assertJsonPath('message', 'Announcement sent to 2 student(s) and supervisor(s) at Records Section in the portal and by email.');
        $this->reached(['regSup', 'atRegistrar']);
        Mail::assertSent(AnnouncementMail::class, fn ($m) => $m->hasBcc($this->people['regSup']->email) && !$m->hasBcc($this->people['libSup']->email));
    }

    public function test_everyone_supervisors_and_recipients(): void
    {
        $this->send(['audience' => 'everyone'])->assertStatus(201)->assertJsonPath('data.recipient_count', 5)
            ->assertJsonPath('data.audience_label', 'Everyone');
        $this->reached(['regSup', 'libSup', 'atRegistrar', 'atLibrary', 'waiting']);

        Notification::fake();
        $this->send(['audience' => 'supervisors'])->assertStatus(201)->assertJsonPath('data.recipient_count', 2)
            ->assertJsonPath('message', 'Announcement sent to 2 supervisor(s) in the portal and by email.');
        $this->reached(['regSup', 'libSup']);

        Notification::fake();
        // Left out = recipients only, as before.
        $this->send([])->assertStatus(201)->assertJsonPath('data.audience', 'recipients')->assertJsonPath('data.recipient_count', 3);
        $this->reached(['atRegistrar', 'atLibrary', 'waiting']);
    }

    public function test_choosing_the_office_and_an_empty_office_are_refused(): void
    {
        $this->send(['audience' => 'office'])->assertStatus(422)->assertJsonPath('errors.office_id.0', AnnouncementService::MSG_CHOOSE_OFFICE);
        $this->send(['audience' => 'parents'])->assertStatus(422)->assertJsonValidationErrors('audience');
        $empty = $this->makeOffice(['name' => 'Test Empty Office']);
        $this->send(['audience' => 'office', 'office_id' => $empty->id])->assertStatus(422)
            ->assertJsonPath('message', AnnouncementService::msgEmptyOffice('Test Empty Office'));
        Notification::assertNothingSent();
    }

    public function test_the_page_shows_how_many_each_choice_reaches(): void
    {
        $meta = $this->getJson('/api/admin/announcements')->assertOk()->json('meta');

        $this->assertSame(['everyone' => 5, 'recipients' => 3, 'new_recipients' => 0, 'supervisors' => 2], $meta['audiences']);
        $offices = collect($meta['offices'])->keyBy('name');
        $this->assertSame(2, $offices['Records Section']['count']);
        $this->assertSame(2, $offices['Reading Room']['count']);
    }

    public function test_new_recipients_are_only_this_terms_newly_accepted(): void
    {
        $this->send(['audience' => 'new_recipients'])->assertStatus(422)
            ->assertJsonPath('message', AnnouncementService::MSG_NO_NEW_RECIPIENTS);

        $today = \Illuminate\Support\Carbon::now('Asia/Manila');
        \App\Models\SemesterPeriod::create(['academic_year' => '2026-2027', 'semester' => '1st Semester',
            'start_date' => $today->copy()->subMonth()->toDateString(), 'end_date' => $today->copy()->addMonths(3)->toDateString()]);
        $app = fn ($user, string $type, string $sem = '1st Semester') => \App\Models\Application::create([
            'user_id' => $user->id, 'academic_year' => '2026-2027', 'semester' => $sem, 'status' => 'approved', 'type' => $type]);
        $app($this->people['waiting'], 'new');            // newly accepted this semester
        $app($this->people['atRegistrar'], 'renewal');   // renewing: not new
        $app($this->people['atLibrary'], 'new', '2nd Semester'); // another term

        $this->send(['audience' => 'new_recipients'])->assertStatus(201)
            ->assertJsonPath('data.recipient_count', 1)
            ->assertJsonPath('data.audience_label', 'New recipients')
            ->assertJsonPath('message', 'Announcement sent to 1 new recipient(s) in the portal and by email.');
        $this->reached(['waiting']);
    }
}
