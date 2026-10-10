<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\StudentProfile;
use App\Models\User;
use App\Services\ReportExplorerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * Analytics & Reports: filters, sort and grouping applied server-side, the role
 * scope of every dataset, and PDF/CSV downloads that hold exactly the rows on screen.
 */
class ReportExplorerTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private const TERM = 'academic_year=2024-2025&semester=1st%20Semester';

    private function student(string $first, string $college): User
    {
        $u = $this->makeUser('recipient', ['name' => "$first Student"]);
        StudentProfile::create([
            'user_id' => $u->id, 'student_id_number' => (string) random_int(100000000, 999999999),
            'first_name' => $first, 'last_name' => 'Student', 'college' => $college, 'program' => 'BS', 'year_level' => 2,
        ]);

        return $u;
    }

    /** Four placements: CICS deficient 8 h, CICS deficient 3 h, CNSM deficient 5 h, CNSM qualified. */
    private function seedTerm(): User
    {
        $supervisor = $this->makeUser('supervisor');
        $office = $this->makeOffice(['name' => 'Library']);
        foreach ([['Ana', 'CICS', 'deficient', 8], ['Ben', 'CICS', 'deficient', 3], ['Cai', 'CNSM', 'deficient', 5], ['Dan', 'CNSM', 'qualified', null]] as [$name, $college, $verdict, $short]) {
            $this->makeAssignment($this->student($name, $college), $supervisor, $office, ['term_status' => $verdict, 'deficient_hours' => $short]);
        }

        return $supervisor;
    }

    private function query(array $params): string
    {
        return self::TERM . '&' . http_build_query($params);
    }

    public function test_filters_combine_and_stats_follow_them(): void
    {
        $this->seedTerm();
        Sanctum::actingAs($this->makeUser('admin'));

        $res = $this->getJson('/api/admin/reports/term-results?' . $this->query([
            'filters' => ['college' => ['CICS'], 'verdict' => ['Deficient']],
        ]))->assertOk();

        $this->assertSame(['Ana Student', 'Ben Student'], array_column($res->json('data.rows'), 'recipient'));
        $res->assertJsonPath('data.total_rows', 4);
        // KPI tiles describe the filtered rows, facets the whole term.
        $this->assertSame('2', collect($res->json('data.stats'))->firstWhere('label', 'Deficient')['value']);
        $this->assertSame([['value' => 'CICS', 'count' => 2], ['value' => 'CNSM', 'count' => 2]], $res->json('data.facets.college'));
        $this->assertSame(['College = CICS', 'Verdict = Deficient'], $res->json('data.filters_applied'));
    }

    public function test_sorts_numbers_both_ways_with_blanks_last(): void
    {
        $this->seedTerm();
        Sanctum::actingAs($this->makeUser('admin'));

        $desc = $this->getJson('/api/admin/reports/term-results?' . $this->query(['sort' => 'deficient_hours', 'dir' => 'desc']))->assertOk();
        $this->assertSame([8, 5, 3, null], array_map(fn ($v) => $v === null ? null : (int) $v, array_column($desc->json('data.rows'), 'deficient_hours')));

        $asc = $this->getJson('/api/admin/reports/term-results?' . $this->query(['sort' => 'deficient_hours', 'dir' => 'asc']))->assertOk();
        $this->assertSame([3, 5, 8, null], array_map(fn ($v) => $v === null ? null : (int) $v, array_column($asc->json('data.rows'), 'deficient_hours')));
    }

    public function test_groups_count_rows_or_total_a_metric(): void
    {
        $this->seedTerm();
        Sanctum::actingAs($this->makeUser('admin'));

        $count = $this->getJson('/api/admin/reports/term-results?' . $this->query(['group_by' => 'college']))->assertOk();
        $this->assertEqualsCanonicalizing(
            [['label' => 'CICS', 'value' => 2, 'count' => 2], ['label' => 'CNSM', 'value' => 2, 'count' => 2]],
            $count->json('data.groups'),
        );

        $sum = $this->getJson('/api/admin/reports/term-results?' . $this->query(['group_by' => 'college', 'metric' => 'deficient_hours']))->assertOk();
        $this->assertEquals([['label' => 'CICS', 'value' => 11, 'count' => 2], ['label' => 'CNSM', 'value' => 5, 'count' => 2]], $sum->json('data.groups'));
    }

    public function test_unknown_columns_are_refused(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));

        $this->getJson('/api/admin/reports/term-results?' . $this->query(['filters' => ['password' => ['x']]]))
            ->assertStatus(422)->assertJsonValidationErrors('filters.password');
        $this->getJson('/api/admin/reports/term-results?' . $this->query(['sort' => 'nope']))->assertStatus(422);
        $this->getJson('/api/admin/reports/term-results?' . $this->query(['group_by' => 'recipient']))->assertStatus(422);
        $this->getJson('/api/admin/reports/term-results?' . $this->query(['metric' => 'verdict']))->assertStatus(422);
        $this->getJson('/api/admin/reports/no-such-report?' . self::TERM)->assertStatus(404);
        // Per-term reports need a term.
        $this->getJson('/api/admin/reports/term-results')->assertStatus(422);
    }

    public function test_supervisor_sees_only_their_students_and_not_admin_reports(): void
    {
        $mine = $this->seedTerm();
        $this->makeAssignment($this->student('Eve', 'CICS'), $this->makeUser('supervisor'), $this->makeOffice(['name' => 'Clinic']), ['term_status' => 'deficient']);
        Sanctum::actingAs($mine);

        $rows = $this->getJson('/api/supervisor/reports/term-results?' . self::TERM)->assertOk()->json('data.rows');
        $this->assertNotContains('Eve Student', array_column($rows, 'recipient'));
        $this->assertCount(4, $rows);

        $this->getJson('/api/supervisor/reports/stipend?' . self::TERM)->assertStatus(404);
        $this->getJson('/api/admin/reports/term-results?' . self::TERM)->assertStatus(403);
    }

    public function test_recipient_sees_only_their_own_logs(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $me = $this->makeUser('recipient');
        $other = $this->makeUser('recipient');
        $mine = $this->makeAssignment($me, $supervisor);
        $this->makeClosedLog($mine, 3, 'verified', daysAgo: 2);
        $this->makeClosedLog($mine, 2, 'pending_verification', daysAgo: 1);
        $this->makeClosedLog($this->makeAssignment($other, $supervisor), 7);
        Sanctum::actingAs($me);

        $res = $this->getJson('/api/recipient/reports/time-logs?' . http_build_query(['filters' => ['status' => ['Verified']]]))->assertOk();
        $res->assertJsonPath('data.total_rows', 2);
        $this->assertEquals([3], array_column($res->json('data.rows'), 'hours'));
        $this->assertSame('3', collect($res->json('data.stats'))->firstWhere('label', 'Verified Hours')['value']);

        $terms = $this->getJson('/api/recipient/reports/terms')->assertOk()->json('data.rows');
        $this->assertCount(1, $terms);
        $this->assertEquals(3, $terms[0]['verified_hours']);
    }

    public function test_csv_holds_the_same_filtered_sorted_rows(): void
    {
        $this->seedTerm();
        Sanctum::actingAs($this->makeUser('admin'));
        $params = ['filters' => ['verdict' => ['Deficient']], 'sort' => 'deficient_hours', 'dir' => 'desc'];

        $json = $this->getJson('/api/admin/reports/term-results?' . $this->query($params))->json('data.rows');
        $csv = $this->get('/api/admin/reports/term-results/export?' . $this->query($params + ['format' => 'csv']))
            ->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8')->streamedContent();

        $lines = array_map('str_getcsv', array_filter(explode("\n", trim(substr($csv, 3)))));
        $this->assertSame('Recipient', $lines[0][0]);
        $this->assertSame(array_column($json, 'recipient'), array_column(array_slice($lines, 1), 0));
        $this->assertSame(['Ana Student', 'Cai Student', 'Ben Student'], array_column(array_slice($lines, 1), 0));
    }

    public function test_pdf_downloads_and_is_audited_with_its_filters(): void
    {
        $this->seedTerm();
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);

        $res = $this->get('/api/admin/reports/term-results/export?' . $this->query(['format' => 'pdf', 'filters' => ['college' => ['CICS']]]))
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF', $res->getContent());
        $this->assertStringContainsString('term-results-2024-2025-1stsemester-', $res->headers->get('Content-Disposition'));

        $log = AuditLog::where('action', 'report_exported')->latest('id')->first();
        $this->assertSame($admin->id, $log->user_id);
        $this->assertSame('pdf', $log->new_values['format']);
        $this->assertSame(['college' => ['CICS']], $log->new_values['filters']);
        $this->assertSame(2, $log->new_values['rows']);
    }

    public function test_pdf_can_leave_out_the_graph(): void
    {
        $this->seedTerm();
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);

        // The graph section prints by default and is left out on request.
        $report = $this->getJson('/api/admin/reports/term-results?' . $this->query(['group_by' => 'college']))->assertOk()->json('data');
        $this->assertNotEmpty($report['groups']);
        $view = fn (bool $chart) => view('reports.report', ['report' => $report, 'includeChart' => $chart, 'preparedBy' => 'A', 'generatedAt' => 'now'])->render();
        $this->assertStringContainsString('class="bars"', $view(true));
        $this->assertStringNotContainsString('class="bars"', $view(false));
        $this->assertStringContainsString('class="data"', $view(false), 'the table stays');

        $pdf = $this->spy(\App\Services\ReportPdfService::class);
        $this->get('/api/admin/reports/term-results/export?' . $this->query(['format' => 'pdf', 'include_chart' => '0']))->assertOk();
        $pdf->shouldHaveReceived('render')->withArgs(fn ($r, $by, $chart) => $chart === false)->once();
        $this->assertFalse(AuditLog::where('action', 'report_exported')->latest('id')->first()->new_values['include_chart']);

        $this->get('/api/admin/reports/term-results/export?' . $this->query(['format' => 'pdf']))->assertOk();
        $pdf->shouldHaveReceived('render')->withArgs(fn ($r, $by, $chart) => $chart === true)->once();
    }

    public function test_pdf_refuses_more_rows_than_it_can_render(): void
    {
        $limit = ReportExplorerService::PDF_ROW_LIMIT;
        $supervisor = $this->makeUser('supervisor');
        $me = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($me, $supervisor);
        // One more log than the limit, inserted in bulk.
        $rows = [];
        for ($i = 0; $i <= $limit; $i++) {
            $in = now()->subMinutes(($i + 1) * 10);
            $rows[] = ['assignment_id' => $assignment->id, 'user_id' => $me->id, 'date' => $in->toDateString(),
                'time_in' => $in, 'time_out' => $in->copy()->addMinutes(5), 'status' => 'verified', 'created_at' => now(), 'updated_at' => now()];
        }
        foreach (array_chunk($rows, 500) as $chunk) {
            \App\Models\TimeLog::insert($chunk);
        }
        Sanctum::actingAs($me);

        $this->getJson('/api/recipient/reports/time-logs/export?format=pdf')->assertStatus(422)->assertJsonFragment(['message' => "This report has " . ($limit + 1) . " rows — too many for a PDF (limit $limit). Narrow the filters or download the CSV."]);
        $this->get('/api/recipient/reports/time-logs/export?format=csv')->assertOk();
    }

    public function test_supervisor_roster_pdf_names_their_office(): void
    {
        $office = $this->makeOffice(['name' => 'Registrar']);
        $supervisor = $this->makeUser('supervisor', ['office_id' => $office->id]);
        $this->makeAssignment($this->student('Fay', 'CICS'), $supervisor, $office);
        Sanctum::actingAs($supervisor);

        $this->getJson('/api/supervisor/reports/roster')->assertOk()->assertJsonPath('data.meta.Office', 'Registrar');
        $this->get('/api/supervisor/reports/roster/export?format=pdf')->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_supervisor_periods_list_only_their_students_terms(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $this->makeAssignment($this->makeUser('recipient'), $supervisor);
        $this->makeAssignment($this->makeUser('recipient'), $supervisor, null, ['academic_year' => '2025-2026', 'semester' => '1st Semester']);
        $this->makeAssignment($this->makeUser('recipient'), $supervisor, null, ['academic_year' => '2024-2025', 'semester' => '2nd Semester']);
        $this->makeAssignment($this->makeUser('recipient'), $this->makeUser('supervisor'), null, ['academic_year' => '2030-2031']);
        Sanctum::actingAs($supervisor);

        $this->assertSame([
            ['academic_year' => '2025-2026', 'semester' => '1st Semester'],
            ['academic_year' => '2024-2025', 'semester' => '2nd Semester'],
            ['academic_year' => '2024-2025', 'semester' => '1st Semester'],
        ], $this->getJson('/api/supervisor/reports/periods')->assertOk()->json('data'));
    }

    public function test_periods_open_on_the_current_semester(): void
    {
        // The local calendar that showed the bug: a "2nd Semester" period that already
        // ended sorts before the running 1st Semester by name, so pages opened on it.
        \App\Models\SemesterPeriod::create(['academic_year' => '2026-2027', 'semester' => '2nd Semester', 'start_date' => '2026-10-01', 'end_date' => '2026-10-02']);
        \App\Models\SemesterPeriod::create(['academic_year' => '2026-2027', 'semester' => '1st Semester', 'start_date' => '2026-10-03', 'end_date' => '2026-12-21']);
        $this->makeAssignment($this->makeUser('recipient'), $this->makeUser('supervisor'), null, ['academic_year' => '2025-2026', 'semester' => '2nd Semester']);
        $this->makeAssignment($this->makeUser('recipient'), $this->makeUser('supervisor'), null, ['academic_year' => '2025-2026', 'semester' => '1st Semester']);
        $this->travelTo(\Illuminate\Support\Carbon::parse('2026-10-06 09:00', 'Asia/Manila'));
        Sanctum::actingAs($this->makeUser('admin'));

        $this->assertSame([
            '1st Semester 2026-2027', '2nd Semester 2026-2027', '2nd Semester 2025-2026', '1st Semester 2025-2026',
        ], array_map(fn ($p) => "{$p['semester']} {$p['academic_year']}", $this->getJson('/api/admin/analytics/periods')->assertOk()->json('data')));
    }

    public function test_admin_overview_pdf(): void
    {
        $this->seedTerm();
        Sanctum::actingAs($this->makeUser('admin'));

        $res = $this->get('/api/admin/analytics/overview/export?' . self::TERM)->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF', $res->getContent());
        $this->getJson('/api/admin/analytics/overview/export')->assertStatus(422);
    }

    public function test_offices_report_cells_line_up_with_their_headers(): void
    {
        $office = $this->makeOffice(['name' => 'Zeta Library', 'max_recipients' => 1]);
        $this->makeUser('supervisor', ['office_id' => $office->id]);
        Sanctum::actingAs($this->makeUser('admin'));

        $res = $this->getJson('/api/admin/reports/offices?' . self::TERM . '&search=Zeta')->assertOk();
        $row = $res->json('data.rows.0');
        $this->assertSame(array_column($res->json('data.columns'), 'key'), array_keys($row));
        $this->assertSame(['Zeta Library', 1, 0, 'Empty', 1], [$row['office'], $row['capacity'], $row['active_recipients'], $row['availability'], $row['supervisors']]);
    }
}
