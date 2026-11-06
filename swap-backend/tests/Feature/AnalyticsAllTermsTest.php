<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin → Analytics "All semesters": no term means every term; one term stays as it was. */
class AnalyticsAllTermsTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private const FIRST = 'academic_year=2024-2025&semester=1st%20Semester';

    /** One applicant and one placement (with 6 verified hours) in each of two terms. */
    private function seedTwoTerms(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $office = $this->makeOffice(['name' => 'Library']);
        foreach ([['Ana', '2024-2025', '1st Semester'], ['Ben', '2025-2026', '2nd Semester']] as [$name, $ay, $sem]) {
            $u = $this->makeUser('recipient', ['name' => "$name Student"]);
            StudentProfile::create([
                'user_id' => $u->id, 'student_id_number' => (string) random_int(100000000, 999999999),
                'first_name' => $name, 'last_name' => 'Student', 'college' => 'CICS', 'program' => 'BS', 'year_level' => 2,
            ]);
            Application::create(['user_id' => $u->id, 'academic_year' => $ay, 'semester' => $sem, 'type' => 'new', 'status' => 'approved']);
            $a = $this->makeAssignment($u, $supervisor, $office, ['academic_year' => $ay, 'semester' => $sem]);
            $this->makeClosedLog($a, 6);
        }
    }

    public function test_overview_and_insights_cover_every_term_without_a_term(): void
    {
        $this->seedTwoTerms();
        Sanctum::actingAs($this->makeUser('admin'));

        $all = $this->getJson('/api/admin/analytics/overview')->assertOk();
        $all->assertJsonPath('data.total_applicants', 2)
            ->assertJsonPath('data.approved', 2)
            ->assertJsonPath('data.total_verified_hours', 12)
            ->assertJsonPath('data.hours_interval', 'month')
            ->assertJsonPath('data.tasks', []);

        $one = $this->getJson('/api/admin/analytics/overview?' . self::FIRST)->assertOk();
        $one->assertJsonPath('data.total_applicants', 1)
            ->assertJsonPath('data.total_verified_hours', 6)
            ->assertJsonPath('data.hours_interval', 'week');

        $this->getJson('/api/admin/analytics/insights')->assertOk()
            ->assertJsonPath('data.term_results.placements', 2)
            ->assertJsonPath('data.funnel.submitted', 2)
            ->assertJsonPath('data.renewals.renewal_rate', null)
            ->assertJsonPath('data.renewals.previous_term', null);
        $this->getJson('/api/admin/analytics/insights?' . self::FIRST)->assertOk()
            ->assertJsonPath('data.term_results.placements', 1);

        // Half a term is refused.
        $this->getJson('/api/admin/analytics/overview?academic_year=2024-2025')->assertStatus(422);
        $this->getJson('/api/admin/analytics/insights?semester=1st%20Semester')->assertStatus(422);
    }

    public function test_reports_without_a_term_list_every_term_with_a_term_column(): void
    {
        $this->seedTwoTerms();
        Sanctum::actingAs($this->makeUser('admin'));

        $res = $this->getJson('/api/admin/reports/applications')->assertOk();
        $this->assertContains('term', array_column($res->json('data.columns'), 'key'));
        $this->assertEqualsCanonicalizing(
            ['1st Semester 2024-2025', '2nd Semester 2025-2026'],
            array_column($res->json('data.rows'), 'term'),
        );

        // One term: its rows only, no Term column (as before).
        $one = $this->getJson('/api/admin/reports/applications?' . self::FIRST)->assertOk();
        $this->assertNotContains('term', array_column($one->json('data.columns'), 'key'));
        $this->assertCount(1, $one->json('data.rows'));

        $this->getJson('/api/admin/reports/recipients')->assertOk()->assertJsonCount(2, 'data.rows');

        // Term Results is about one term's verdicts: it still asks for one.
        $this->getJson('/api/admin/reports/term-results')->assertStatus(422)
            ->assertJsonPath('errors.academic_year.0', 'Choose a school year and semester for this report.');
    }

    public function test_summary_pdf_for_all_semesters(): void
    {
        $this->seedTwoTerms();
        Sanctum::actingAs($this->makeUser('admin'));

        $res = $this->get('/api/admin/analytics/overview/export')->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF', $res->getContent());
        $this->assertStringContainsString('program-overview-all-semesters-', $res->headers->get('Content-Disposition'));
    }
}
