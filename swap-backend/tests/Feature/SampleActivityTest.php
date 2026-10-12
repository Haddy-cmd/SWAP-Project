<?php

namespace Tests\Feature;

use App\Models\NarrativeReport;
use App\Models\Setting;
use App\Models\StudentProfile;
use App\Models\TimeLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** swap:sample-activity â€” sample hours, narratives and profile details for the imported recipients. */
class SampleActivityTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function profile(User $user, array $attrs = []): StudentProfile
    {
        return StudentProfile::create($attrs + ['user_id' => $user->id, 'student_id_number' => (string) (202300000 + $user->id),
            'first_name' => 'Test', 'last_name' => "Student {$user->id}", 'college' => 'CICS', 'program' => 'BSIT', 'year_level' => 3]);
    }

    public function test_recipients_get_hours_narratives_and_profiles_and_remove_puts_everything_back(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-13 10:00', 'Asia/Manila'));
        $start = ['start_date' => '2026-08-17'];
        $sup = $this->makeUser('supervisor');

        $placed = $this->makeUser('recipient', ['email' => 'abdul.ha337@s.msumain.edu.ph']);
        $this->profile($placed);
        $assignment = $this->makeAssignment($placed, $sup, $this->makeOffice(['name' => 'Office of the Registrar']), $start);

        $waiting = $this->makeUser('recipient');
        $this->profile($waiting, ['address' => 'Kept address']);

        $kept = $this->makeUser('recipient', ['email' => 'norodin.nm262@s.msumain.edu.ph']);
        $this->profile($kept);
        $keptAssignment = $this->makeAssignment($kept, $sup, null, $start);

        $active = $this->makeUser('recipient');
        $this->profile($active);
        $realLog = $this->makeClosedLog($this->makeAssignment($active, $sup, null, $start), 4);

        $csv = sys_get_temp_dir() . '/swap_test_contacts.csv';
        file_put_contents($csv, "Institutional_Email,Contact_Number\nabdul.ha337@s.msumain.edu.ph,0975 496 8172\n");

        $this->artisan('swap:sample-activity', ['--applicants' => $csv, '--force' => true])->assertSuccessful();

        // Hours: weekdays from the start date to yesterday, a narrative on each, within the term.
        $logs = TimeLog::where('assignment_id', $assignment->id)->get();
        $this->assertGreaterThan(3, $logs->count());
        $this->assertSame($logs->count(), NarrativeReport::whereIn('time_log_id', $logs->pluck('id'))->count());
        $total = (float) $logs->sum('duration_hours');
        $this->assertTrue($total > 0 && $total <= 230, "total {$total}");
        // Duty fits around classes: no block runs past 6 hours.
        $this->assertSame(0, $logs->filter(fn ($l) => (float) $l->duration_hours > 6.25)->count());
        foreach ($logs as $log) {
            $day = Carbon::parse($log->date);
            $this->assertTrue($day->isWeekday() && $day->toDateString() >= '2026-08-17' && $day->toDateString() < '2026-10-13');
            $this->assertSame($day->toDateString(), $log->time_in->copy()->timezone('Asia/Manila')->toDateString());
        }
        $this->assertStringContainsString('Office of the Registrar', NarrativeReport::whereIn('time_log_id', $logs->pluck('id'))->value('content'));
        $this->assertEmpty(array_diff($logs->pluck('status')->unique()->all(), ['verified', 'pending_verification', 'rejected']));
        $this->assertSame(0, $logs->where('status', 'verified')->whereNull('verified_by')->count());

        // Profiles: empty fields filled, the CSV's real number used, existing values kept.
        $p = $placed->profile()->first();
        $this->assertSame('0975 496 8172', $p->contact_number);
        $this->assertNotNull($p->date_of_birth);
        $this->assertStringContainsString('Lanao del Sur', $p->address);
        $this->assertSame('Kept address', $waiting->profile()->first()->address);
        $this->assertNotNull($waiting->profile()->first()->contact_number, 'recipients waiting for an office still get profile details');
        $this->assertSame(0, TimeLog::where('user_id', $waiting->id)->count());

        // Never touched: the kept account and anyone who already has real logs.
        $this->assertSame(0, TimeLog::where('assignment_id', $keptAssignment->id)->count());
        $this->assertNull($kept->profile()->first()->contact_number);
        $this->assertSame([$realLog->id], TimeLog::where('user_id', $active->id)->pluck('id')->all());

        // A second run is refused; --remove deletes exactly the sample and restores the profiles.
        $this->artisan('swap:sample-activity', ['--force' => true])->assertFailed();
        $this->artisan('swap:sample-activity', ['--remove' => true, '--force' => true])->assertSuccessful();
        $this->assertSame(0, TimeLog::where('assignment_id', $assignment->id)->count());
        $this->assertSame(0, NarrativeReport::count());
        $this->assertNotNull(TimeLog::find($realLog->id));
        $this->assertNull($placed->profile()->first()->contact_number);
        $this->assertNull($placed->profile()->first()->address);
        $this->assertSame('Kept address', $waiting->profile()->first()->address);
        $this->assertNull(Setting::get('sample_activity'));
    }

    public function test_a_dry_run_changes_nothing(): void
    {
        $user = $this->makeUser('recipient');
        $this->profile($user);
        $this->makeAssignment($user, $this->makeUser('supervisor'), null, ['start_date' => now()->subWeeks(3)->toDateString()]);

        $this->artisan('swap:sample-activity', ['--dry-run' => true])->assertSuccessful();

        $this->assertSame(0, TimeLog::count());
        $this->assertNull($user->profile()->first()->address);
        $this->assertNull(Setting::get('sample_activity'));
    }
}
