<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\PromissoryNote;
use App\Models\StipendHistory;
use App\Models\TimeLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Recipient → pace, forecast, hours breakdown and the stipend/renewal checklist. */
class RecipientProgressTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    protected function setUp(): void
    {
        parent::setUp();
        // Mon Oct 5, 2026, 10:00 in Manila.
        Carbon::setTestNow(Carbon::parse('2026-10-05 10:00', 'Asia/Manila'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function log(Assignment $a, string $date, float $hours, string $status = 'verified', array $extra = []): TimeLog
    {
        $in = Carbon::parse("{$date} 08:00", 'Asia/Manila');

        return TimeLog::create(['assignment_id' => $a->id, 'user_id' => $a->user_id, 'date' => $date, 'time_in' => $in,
            'time_out' => $in->copy()->addMinutes((int) round($hours * 60)), 'status' => $status] + $extra);
    }

    public function test_pace_forecast_and_breakdown(): void
    {
        $recipient = $this->makeUser('recipient');
        $a = $this->makeAssignment($recipient, $this->makeUser('supervisor'), null,
            ['required_hours' => 100, 'start_date' => '2026-08-01', 'end_date' => '2026-11-29']);
        $this->log($a, '2026-08-20', 10);                       // before the 28-day window
        $this->log($a, '2026-09-20', 5);
        $this->log($a, '2026-09-25', 5);
        $this->log($a, '2026-09-30', 3, extra: ['is_manual' => true]);   // bonus
        $this->log($a, '2026-10-03', 2, 'pending_verification');
        $this->log($a, '2026-10-01', 1, 'rejected', ['rejection_reason' => 'Wrong office']);

        Sanctum::actingAs($recipient);
        $data = $this->getJson('/api/recipient/progress')->assertOk()->json('data');

        $this->assertSame('1st Semester 2024-2025', $data['term']);
        $this->assertSame('behind', $data['pace']['status']);
        // 100 − 23 verified − 2 pending = 75 to go; 15 h in the last 28 days = 3.75 h/week;
        // Oct 5 – Nov 29 is 56 days = 8 weeks → 9.4 h/week; 75 ÷ 3.75 × 7 = 140 days → Feb 22, 2027.
        $this->assertEquals(['outstanding_hours' => 75, 'weeks_left' => 8, 'hours_per_week_needed' => 9.4,
            'recent_weekly_average' => 3.75, 'projected_finish' => '2027-02-22', 'on_time' => false], $data['forecast']);

        $b = $data['breakdown'];
        $this->assertEquals([23, 2, 1, 3, 5, 5.5], [$b['verified_hours'], $b['pending_hours'], $b['rejected_hours'],
            $b['bonus_hours'], $b['days_on_duty'], $b['avg_session_hours']]);
        $this->assertSame([['id' => $b['rejected_logs'][0]['id'], 'date' => '2026-10-01', 'hours' => 1, 'reason' => 'Wrong office']], $b['rejected_logs']);
    }

    public function test_checklist_follows_the_release_and_renewal_rules(): void
    {
        $recipient = $this->makeUser('recipient');
        $a = $this->makeAssignment($recipient, $this->makeUser('supervisor'), null,
            ['required_hours' => 10, 'start_date' => '2026-06-01', 'end_date' => '2026-10-01']);
        $this->log($a, '2026-09-01', 4);

        Sanctum::actingAs($recipient);
        $states = fn () => collect($this->getJson('/api/recipient/progress')->assertOk()->json('data.checklist'))
            ->mapWithKeys(fn ($i) => [$i['key'] => [$i['state'], $i['label']]])->all();

        // Term over, 6 hours short, nothing else done.
        $this->assertSame([
            'hours' => ['todo', 'Short 6 hours — file a promissory note'],
            'signature' => ['done', 'Digital signature saved'],
            'report' => ['todo', 'Submit your end-of-term narrative report'],
            'stipend' => ['waiting', 'Stipend released by the DSA once the items above are done'],
        ], $states());

        // Note approved, report accepted but marked not eligible, signature file lost, stub ready.
        PromissoryNote::create(['assignment_id' => $a->id, 'user_id' => $recipient->id, 'academic_year' => $a->academic_year,
            'semester' => $a->semester, 'verified_hours_snapshot' => 4, 'lacking_hours' => 6, 'deficient_hours' => 6,
            'status' => 'approved', 'file_path' => 'p.pdf', 'file_name' => 'p.pdf', 'mime_type' => 'application/pdf', 'file_size' => 1]);
        $this->submitTermReport($a)->forceFill(['reviewed_at' => now(), 'renewal_eligible' => false])->save();
        Storage::disk('public')->delete($recipient->signature_image_path);
        StipendHistory::create(['user_id' => $recipient->id, 'amount' => 5000, 'academic_year' => $a->academic_year,
            'semester' => $a->semester, 'status' => 'certified', 'control_number' => 'C-1']);

        $this->assertSame([
            'hours' => ['done', 'Short 6 hours — promissory note approved'],
            'signature' => ['todo', 'Your signature image was lost — draw it again'],
            'report' => ['blocked', 'End-of-term report accepted — marked not eligible for renewal'],
            'stipend' => ['todo', 'Claim stub ready — bring it to the Banking Office'],
        ], $states());
    }

    public function test_no_placement_and_other_roles(): void
    {
        Sanctum::actingAs($this->makeUser('recipient'));
        $this->getJson('/api/recipient/progress')->assertOk()->assertJsonPath('data', null);

        Sanctum::actingAs($this->makeUser('applicant'));
        $this->getJson('/api/recipient/progress')->assertForbidden();
    }
}
