<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\SemesterPeriod;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** swap:import-students — replace dummy accounts with the DSA lists. */
class ImportStudentsTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private string $recipients;
    private string $applicants;

    protected function setUp(): void
    {
        parent::setUp();
        SemesterPeriod::create(['academic_year' => '2026-2027', 'semester' => '1st Semester',
            'start_date' => now()->subMonth()->toDateString(), 'end_date' => now()->addMonths(3)->toDateString()]);

        $dir = sys_get_temp_dir();
        $this->recipients = "{$dir}/swap_test_recipients.csv";
        $this->applicants = "{$dir}/swap_test_applicants.csv";
        file_put_contents($this->recipients, implode("\n", [
            'Highlighted,Program,ID_Number,Last_Name,First_Name,Middle_Initial,Full_Name,Year_Level,Course,College,Institutional_Email,Note',
            'No,SWAP,202315613,Abdul,Hedjara,A,Hedjara A. Abdul,4th Year,BS Extension Education,COA,abdul.ha337@s.msumain.edu.ph,',
            'Yes,SANTA,202399308,Salic,Salman,S,Salman S. Salic,4th Year,BSET Construction,COE,salic.ss660@s.msumain.edu.ph,',
            'No,SWAP,202388382,Norodin,Norhadi,M,Norhadi M. Norodin,4th Year,BS Information Technology,CICS,norodin.nm262@s.msumain.edu.ph,',
        ]));
        file_put_contents($this->applicants, implode("\n", [
            'Sheet_No,ID_Number,Last_Name,First_Name,Middle_Initial,Full_Name,Year_Level,Course,College,Institutional_Email,Contact_Number,Program,Record,Note',
            '4,202399308,Salic,Salman,S,Salman S. Salic,4th Year,BSET,COE,salic.ss660@s.msumain.edu.ph,0975 496 8172,SANTA,Existing,',
            '2,202418981,Solaiman,Farhan,M,Farhan M. Solaiman,3rd Year,BSEd Sciences,CED,solaiman.fm423@s.msumain.edu.ph,0956 055 6685,,New,',
        ]));
    }

    private function import(array $extra = [])
    {
        return $this->artisan('swap:import-students', ['--recipients' => $this->recipients, '--applicants' => $this->applicants, '--force' => true] + $extra);
    }

    public function test_dummies_go_the_lists_come_in_and_the_kept_accounts_stay(): void
    {
        Notification::fake();
        $admin = $this->makeUser('admin');
        $haddy = $this->makeUser('supervisor', ['name' => 'Prof.haddy']);
        $kept = $this->makeUser('applicant', ['email' => 'norodin.nm262@s.msumain.edu.ph']);
        $jumailah = $this->makeUser('recipient', ['email' => 'mamalampac.ja575@s.msumain.edu.ph']);
        $dummySup = $this->makeUser('supervisor', ['email' => 'supervisor1@test.swap']);
        $office = $this->makeOffice(['name' => 'College of Agriculture']);
        // A kept student supervised by a dummy supervisor moves to the office's new supervisor.
        $placement = $this->makeAssignment($jumailah, $dummySup, $office, ['academic_year' => '2026-2027', 'semester' => '1st Semester']);
        $dummy = $this->makeUser('recipient', ['email' => 'recipient1@test.swap']);
        $this->makeClosedLog($this->makeAssignment($dummy, $dummySup), 4);

        $this->import()->assertSuccessful();

        foreach ([$admin, $haddy, $kept, $jumailah] as $u) {
            $this->assertNotNull(User::find($u->id), "{$u->email} kept");
        }
        $this->assertNull(User::withTrashed()->find($dummy->id));
        $this->assertNull(User::withTrashed()->find($dummySup->id));
        $this->assertSame(0, Assignment::where('user_id', $dummy->id)->count());
        $this->assertNotSame($dummySup->id, $placement->fresh()->supervisor_id);
        $this->assertSame('applicant', $kept->fresh()->role, 'an existing account is not replaced');

        // Recipients: profile + current-term placement + QR, password Student@123.
        $hedjara = User::where('email', 'abdul.ha337@s.msumain.edu.ph')->firstOrFail();
        $this->assertSame('recipient', $hedjara->role);
        $this->assertSame('Hedjara A. Abdul', $hedjara->name);
        $this->assertTrue(Hash::check('Student@123', $hedjara->password));
        $this->assertNotNull($hedjara->email_verified_at);
        $this->assertSame('COA', $hedjara->profile->college);
        $a = Assignment::where('user_id', $hedjara->id)->firstOrFail();
        $this->assertSame(['active', '1st Semester', '2026-2027', 200], [$a->status, $a->semester, $a->academic_year, (int) $a->required_hours]);
        $this->assertNotEmpty($a->qr_secret);
        $this->assertSame('CoE', User::where('email', 'salic.ss660@s.msumain.edu.ph')->first()->profile->college);

        // Highlighted recipient: approved application, no office yet (Assignments → to assign).
        $salic = User::where('email', 'salic.ss660@s.msumain.edu.ph')->first();
        $this->assertSame('recipient', $salic->role);
        $this->assertSame(0, Assignment::where('user_id', $salic->id)->count());
        $this->assertSame('approved', \App\Models\Application::where('user_id', $salic->id)->value('status'));
        $this->assertSame(1, User::where('email', 'salic.ss660@s.msumain.edu.ph')->count(), 'not duplicated as an applicant');

        // Applicants: a submitted application with the four placeholder documents, which open.
        $farhan = User::where('email', 'solaiman.fm423@s.msumain.edu.ph')->first();
        $this->assertSame('applicant', $farhan->role);
        $app = \App\Models\Application::where('user_id', $farhan->id)->firstOrFail();
        $this->assertSame('submitted', $app->status);
        $this->assertSame(['cor', 'grades', 'id_photo', 'letter_of_intent'], $app->documents()->orderBy('document_type')->pluck('document_type')->all());
        $token = $admin->createToken('test')->plainTextToken;
        $doc = $app->documents()->where('document_type', 'cor')->first();
        $this->withHeaders(['Authorization' => "Bearer {$token}"])->get("/api/documents/{$doc->id}/file")
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');

        // Offices without a supervisor got one; nothing was sent; codes are off.
        $this->assertTrue(User::where('email', 'coa.supervisor@swap.test')->where('office_id', $office->id)->exists());
        Notification::assertNothingSent();
        $this->assertFalse(\App\Models\Setting::bool('login_otp_enabled', true));

        // The imported student signs in with the password.
        $this->postJson('/api/auth/login', ['email' => 'abdul.ha337@s.msumain.edu.ph', 'password' => 'Student@123'])->assertOk();
    }

    public function test_a_dry_run_changes_nothing(): void
    {
        $dummy = $this->makeUser('recipient', ['email' => 'recipient1@test.swap']);
        $this->makeOffice();

        $this->import(['--dry-run' => true])->assertSuccessful();

        $this->assertNotNull(User::find($dummy->id));
        $this->assertNull(User::where('email', 'abdul.ha337@s.msumain.edu.ph')->first());
        $this->assertSame(0, StudentProfile::count());
    }
}
