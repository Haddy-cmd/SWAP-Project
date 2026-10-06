<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Assignment;
use App\Models\PromissoryNote;
use App\Models\SemesterPeriod;
use App\Models\StipendHistory;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin → Analytics → Program insights for one term. */
class ProgramInsightsTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private const TERM = ['academic_year' => '2024-2025', 'semester' => '1st Semester'];

    private function insights(array $term = self::TERM): array
    {
        Sanctum::actingAs($this->makeUser('admin'));

        return $this->getJson('/api/admin/analytics/insights?' . http_build_query($term))->assertOk()->json('data');
    }

    private function note(Assignment $a, string $status): void
    {
        PromissoryNote::create([
            'assignment_id' => $a->id, 'user_id' => $a->user_id, 'academic_year' => $a->academic_year, 'semester' => $a->semester,
            'verified_hours_snapshot' => 4, 'lacking_hours' => 6, 'deficient_hours' => 6, 'status' => $status,
            'file_path' => 'promissory/x.pdf', 'file_name' => 'x.pdf', 'mime_type' => 'application/pdf', 'file_size' => 100,
        ]);
    }

    public function test_term_results_money_integrity_workload_and_offices(): void
    {
        $office = $this->makeOffice(['max_recipients' => 5, 'name' => 'Registrar']);
        $supervisor = $this->makeUser('supervisor');
        [$r1, $r2, $r3] = [$this->makeUser('recipient'), $this->makeUser('recipient'), $this->makeUser('recipient')];
        $a1 = $this->makeAssignment($r1, $supervisor, $office, ['required_hours' => 10, 'term_status' => 'qualified']);
        $a2 = $this->makeAssignment($r2, $supervisor, $office, ['required_hours' => 10, 'status' => 'completed', 'term_status' => 'deficient', 'deficient_hours' => 6]);
        $a3 = $this->makeAssignment($r3, $supervisor, $office, ['required_hours' => 10]);
        $this->note($a2, PromissoryNote::STATUS_APPROVED);
        $this->note($a3, PromissoryNote::STATUS_PENDING);
        // r2 renewed: the 6 lacking hours were added to the next term.
        $this->makeAssignment($r2, $supervisor, $office, ['semester' => '2nd Semester', 'required_hours' => 16, 'carried_over_hours' => 6, 'carried_from_assignment_id' => $a2->id]);

        // Logs: verified + flagged (verified 2 h after clock-out), an automatic clock-out still
        // pending without a task description, a rejected one, and bonus hours (never need one).
        $verified = $this->makeClosedLog($a1, 4, 'verified', daysAgo: 5);
        $verified->update(['location_flagged' => true, 'verified_by' => $supervisor->id, 'verified_at' => $verified->time_out->copy()->addHours(2)]);
        $this->addNarrative($verified);
        $pending = $this->makeClosedLog($a1, 2, 'pending_verification', daysAgo: 3);
        $pending->update(['clocked_out_reason' => 'auto_stale', 'time_in' => now()->subDays(3)->subHours(3), 'time_out' => now()->subDays(3)->subHour()]);
        $this->addNarrative($this->makeClosedLog($a3, 1, 'rejected', daysAgo: 2));
        $this->makeClosedLog($a3, 2, 'verified', daysAgo: 1)->update(['is_manual' => true]);

        // Stubs: a legacy one received at the Banking Office, a legacy ready-to-claim one
        // (via a note), and a void one. A release is final, so both live ones count as released.
        StipendHistory::create(self::TERM + ['user_id' => $r1->id, 'amount' => 5000, 'status' => 'claimed', 'certified_at' => now()->subDays(4), 'claimed_at' => now()->subDays(1), 'control_number' => 'A-1']);
        StipendHistory::create(self::TERM + ['user_id' => $r2->id, 'amount' => 4000, 'status' => 'certified', 'certified_at' => now()->subDays(20), 'via_promissory' => true, 'control_number' => 'A-2']);
        StipendHistory::create(self::TERM + ['user_id' => $r3->id, 'amount' => 9999, 'status' => 'void', 'certified_at' => now()->subDays(30), 'control_number' => 'A-3']);

        $data = $this->insights();

        $this->assertSame(['placements' => 3, 'qualified' => 1, 'deficient' => 1, 'in_progress' => 1, 'deficient_hours' => 6,
            'promissory' => ['filed' => 2, 'approved' => 1, 'rejected' => 0, 'pending' => 1], 'carried_hours' => 6], $data['term_results']);

        $this->assertEquals(['released' => 2, 'released_amount' => 9000, 'via_promissory' => 1, 'voided' => 1,
            'ready_to_release' => 0, 'missing_requirements' => 0], $data['stipend']);

        $this->assertSame([['office' => 'Registrar', 'logs' => 4, 'flagged' => 1, 'auto_clock_outs' => 1, 'rejected' => 1, 'missing_task' => 1]], $data['integrity']);

        $this->assertCount(1, $data['workload']);
        $this->assertSame([1, 2.0, 3, 1, 2.0], [$data['workload'][0]['pending'], (float) $data['workload'][0]['pending_hours'],
            $data['workload'][0]['oldest_pending_days'], $data['workload'][0]['verified'], (float) $data['workload'][0]['avg_verify_hours']]);

        $registrar = collect($data['offices'])->firstWhere('office', 'Registrar');
        // r1 and r3 are current (r2's term is completed); 6 verified of 30 required.
        $this->assertSame([5, 2, 6.0, 20.0], [$registrar['capacity'], $registrar['filled'], (float) $registrar['verified_hours'], (float) $registrar['avg_completion']]);
    }

    public function test_renewals_and_the_application_funnel(): void
    {
        $today = now('Asia/Manila');
        SemesterPeriod::create(['academic_year' => '2024-2025', 'semester' => '1st Semester',
            'start_date' => $today->copy()->subDays(200)->toDateString(), 'end_date' => $today->copy()->subDays(80)->toDateString()]);
        SemesterPeriod::create(['academic_year' => '2024-2025', 'semester' => '2nd Semester',
            'start_date' => $today->copy()->subDays(70)->toDateString(), 'end_date' => $today->copy()->addDays(50)->toDateString()]);
        $term = ['academic_year' => '2024-2025', 'semester' => '2nd Semester'];

        // Three recipients last term; one renewal approved, one without its COR, one whose
        // completed term was never paid out.
        $supervisor = $this->makeUser('supervisor');
        $renewal = function (User $u, string $status, bool $cor) use ($term): void {
            $app = Application::create($term + ['user_id' => $u->id, 'status' => $status, 'type' => 'renewal']);
            if ($cor) {
                $app->documents()->create(['document_type' => 'cor', 'file_path' => "documents/{$app->id}/cor.pdf", 'file_url' => '/x',
                    'file_name' => 'cor.pdf', 'file_size' => 1000, 'mime_type' => 'application/pdf']);
            }
        };
        foreach (['approved' => true, 'submitted' => false, 'under_review' => true] as $status => $cor) {
            $u = $this->makeUser('recipient');
            $prev = $this->makeAssignment($u, $supervisor, null, ['required_hours' => 2, 'status' => 'completed']);
            $this->makeClosedLog($prev, 2);
            $renewal($u, $status, $cor);
        }

        // New applications: approved after 4 days, rejected after 2, a no-show, one interview set.
        $app = function (string $status, string $college = null, int $daysAgo = 1, ?int $decidedAfter = null, ?string $interview = null) use ($term) {
            $u = $this->makeUser('applicant');
            if ($college) {
                StudentProfile::create(['user_id' => $u->id, 'student_id_number' => (string) random_int(100000000, 999999999),
                    'first_name' => 'A', 'last_name' => 'B', 'college' => $college, 'program' => 'BS', 'year_level' => 1]);
            }
            $a = Application::create($term + ['user_id' => $u->id, 'status' => $status, 'type' => 'new']);
            $a->forceFill(['created_at' => now()->subDays($daysAgo), 'reviewed_at' => $decidedAfter !== null ? now()->subDays($daysAgo - $decidedAfter) : null])->save();
            if ($interview) {
                $a->interview()->create(['scheduled_at' => now()->addDay(), 'mode' => 'in_person', 'status' => $interview]);
            }
        };
        $app('approved', 'CICS', daysAgo: 5, decidedAfter: 4);
        $app('rejected', 'CICS', daysAgo: 3, decidedAfter: 2);
        $app('under_review', 'COE', interview: 'no_show');
        $app('interview_scheduled', interview: 'scheduled');

        $data = $this->insights($term);

        $renewals = $data['renewals'];
        $this->assertSame([3, 1, 0, 2, 3, 33.3], [$renewals['submitted'], $renewals['approved'], $renewals['rejected'], $renewals['waiting'],
            $renewals['previous_recipients'], $renewals['renewal_rate']]);
        $this->assertSame('1st Semester 2024-2025', $renewals['previous_term']);
        $this->assertEqualsCanonicalizing(
            [['reason' => 'No updated COR', 'count' => 1], ['reason' => 'Stipend not released yet', 'count' => 1]],
            $renewals['waiting_reasons'],
        );

        $funnel = $data['funnel'];
        $this->assertSame([4, 2, 1, 1, 2, 1, 3.0], [$funnel['submitted'], $funnel['interviewed'], $funnel['approved'], $funnel['rejected'],
            $funnel['waiting'], $funnel['no_shows'], (float) $funnel['avg_days_to_decision']]);
        $this->assertSame(['college' => 'CICS', 'total' => 2, 'approved' => 1, 'rejected' => 1], $funnel['by_college'][0]);
    }

    public function test_term_results_export(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $office = $this->makeOffice(['name' => 'Library']);
        $met = $this->makeUser('recipient', ['name' => 'Ana Met']);
        $short = $this->makeUser('recipient', ['name' => 'Ben Short']);
        $metTerm = $this->makeAssignment($met, $supervisor, $office, ['required_hours' => 2, 'status' => 'completed', 'term_status' => 'qualified']);
        $shortTerm = $this->makeAssignment($short, $supervisor, $office, ['required_hours' => 10, 'term_status' => 'deficient', 'deficient_hours' => 8]);
        $this->makeClosedLog($metTerm, 2);
        $this->makeClosedLog($shortTerm, 2);
        $this->submitTermReport($metTerm)->forceFill(['reviewed_at' => now(), 'renewal_eligible' => true])->save();
        $this->note($shortTerm, PromissoryNote::STATUS_APPROVED);
        StipendHistory::create(self::TERM + ['user_id' => $met->id, 'amount' => 5000, 'status' => 'claimed', 'control_number' => 'T-1']);
        Application::create(['user_id' => $met->id, 'academic_year' => '2024-2025', 'semester' => '2nd Semester', 'status' => 'approved', 'type' => 'renewal']);

        Sanctum::actingAs($this->makeUser('admin'));
        $res = $this->getJson('/api/admin/reports/term-results?' . http_build_query(self::TERM))->assertOk();

        $this->assertSame('Term Results', $res->json('data.title'));
        $pick = fn ($r) => array_intersect_key($r, array_flip(['recipient', 'office', 'required_hours', 'verified_hours', 'verdict', 'deficient_hours', 'promissory', 'report', 'stipend', 'renewal']));
        $this->assertEquals([
            ['recipient' => 'Ana Met', 'office' => 'Library', 'required_hours' => 2, 'verified_hours' => 2, 'verdict' => 'Qualified', 'deficient_hours' => null, 'promissory' => null, 'report' => 'Accepted · Eligible', 'stipend' => 'Released', 'renewal' => 'Approved'],
            ['recipient' => 'Ben Short', 'office' => 'Library', 'required_hours' => 10, 'verified_hours' => 2, 'verdict' => 'Deficient', 'deficient_hours' => 8, 'promissory' => 'Approved', 'report' => 'Missing', 'stipend' => 'Not Released', 'renewal' => 'None'],
        ], array_map($pick, $res->json('data.rows')));
        $this->assertSame(['1', '1', '1', '1'], array_column($res->json('data.stats'), 'value'));
    }

    public function test_stipend_insights_split_who_is_ready_for_release(): void
    {
        $supervisor = $this->makeUser('supervisor');
        // Hours met with signature and end-of-term report: ready.
        $ready = $this->makeAssignment($this->makeUser('recipient'), $supervisor, null, ['required_hours' => 2]);
        $this->makeClosedLog($ready, 2);
        $this->submitTermReport($ready);
        // Hours met, report not in yet: still missing a requirement.
        $this->makeClosedLog($this->makeAssignment($this->makeUser('recipient'), $supervisor, null, ['required_hours' => 2]), 2);
        // Another term's payable recipient isn't counted here.
        $other = $this->makeAssignment($this->makeUser('recipient'), $supervisor, null, ['required_hours' => 2, 'semester' => '2nd Semester']);
        $this->makeClosedLog($other, 2);
        $this->submitTermReport($other);
        // Already released this term.
        StipendHistory::create(self::TERM + ['user_id' => $this->makeUser('recipient')->id, 'amount' => 5000, 'status' => 'released', 'control_number' => 'R-1']);

        $this->assertEquals(['released' => 1, 'released_amount' => 5000, 'via_promissory' => 0, 'voided' => 0,
            'ready_to_release' => 1, 'missing_requirements' => 1], $this->insights()['stipend']);
    }

    public function test_the_overview_splits_applicants_by_college_by_outcome(): void
    {
        foreach (['approved', 'approved', 'rejected', 'submitted'] as $i => $status) {
            $u = $this->makeUser('applicant');
            StudentProfile::create(['user_id' => $u->id, 'student_id_number' => "20250000{$i}", 'first_name' => 'A', 'last_name' => 'B',
                'college' => 'CICS', 'program' => 'BSIT', 'year_level' => 1]);
            Application::create(self::TERM + ['user_id' => $u->id, 'status' => $status, 'type' => 'new']);
        }

        Sanctum::actingAs($this->makeUser('admin'));
        $this->getJson('/api/admin/analytics/overview?' . http_build_query(self::TERM))->assertOk()
            ->assertJsonPath('data.applicants_by_college.0', ['college' => 'CICS', 'applicant_count' => 4, 'approved' => 2, 'rejected' => 1, 'pending' => 1]);
    }

    public function test_only_admins_see_it(): void
    {
        Sanctum::actingAs($this->makeUser('supervisor'));
        $this->getJson('/api/admin/analytics/insights?' . http_build_query(self::TERM))->assertForbidden();
    }
}
