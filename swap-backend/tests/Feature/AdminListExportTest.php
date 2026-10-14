<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\StipendHistory;
use App\Models\StudentProfile;
use App\Services\AuditLogService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** CSV downloads on Stipend → History and Audit Logs: the same rows the page's filters show. */
class AdminListExportTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    /** @return list<list<string>> the CSV without its BOM, header first */
    private function csv($response): array
    {
        $response->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $body = $response->streamedContent();
        $this->assertSame("\xEF\xBB\xBF", substr($body, 0, 3));
        $lines = preg_split('/\r?\n/', trim(substr($body, 3)));

        return array_map(fn ($l) => str_getcsv($l), $lines);
    }

    public function test_stipend_history_csv_follows_the_filters_and_is_audited(): void
    {
        $admin = $this->makeUser('admin');
        $student = $this->makeUser('recipient', ['name' => '=HYPERLINK("x")']);
        StudentProfile::create(['user_id' => $student->id, 'student_id_number' => '202312345', 'first_name' => 'A', 'last_name' => 'B', 'college' => 'CICS', 'program' => 'BSIT', 'year_level' => 3]);
        $other = $this->makeUser('recipient', ['name' => 'Other Student']);
        $term = ['academic_year' => '2026-2027', 'semester' => '1st Semester'];
        StipendHistory::create($term + ['user_id' => $student->id, 'amount' => 5000, 'status' => 'released', 'control_number' => 'SWAP-1',
            'released_at' => now(), 'released_by' => $admin->id, 'via_promissory' => true, 'deficient_hours' => 12]);
        StipendHistory::create($term + ['user_id' => $other->id, 'amount' => 4000, 'status' => 'void', 'control_number' => 'SWAP-2', 'void_reason' => 'Duplicate']);
        StipendHistory::create(['academic_year' => '2025-2026', 'semester' => '2nd Semester', 'user_id' => $other->id, 'amount' => 3000, 'status' => 'released', 'control_number' => 'SWAP-OLD']);
        Sanctum::actingAs($admin);

        $rows = $this->csv($this->get('/api/admin/stipend/export?academic_year=2026-2027&semester=1st+Semester&sort=amount'));
        $this->assertSame(['Control no.', 'Recipient', 'Student ID', 'Email', 'College', 'Term', 'Amount', 'Status', 'Released', 'Received', 'Via promissory', 'Deficient hours', 'Void reason', 'Released by'], $rows[0]);
        $this->assertSame(['SWAP-1', 'SWAP-2'], array_column(array_slice($rows, 1), 0), 'that term only, by amount');
        $this->assertSame("'=HYPERLINK(\"x\")", $rows[1][1], 'formula-safe');
        $this->assertSame(['202312345', 'CICS', '1st Semester 2026-2027', '5000', 'Released'], [$rows[1][2], $rows[1][4], $rows[1][5], $rows[1][6], $rows[1][7]]);
        $this->assertSame(['Yes', '12', $admin->name], [$rows[1][10], $rows[1][11], $rows[1][13]]);
        $this->assertSame(['Void', 'Duplicate'], [$rows[2][7], $rows[2][12]]);

        // The status chip narrows it like the list.
        $this->assertCount(2, $this->csv($this->get('/api/admin/stipend/export?status=void')));

        $log = AuditLog::where('action', 'report_exported')->firstOrFail();
        $this->assertSame(['stipend-history', 'csv', 2], [$log->new_values['type'], $log->new_values['format'], $log->new_values['rows']]);

        Sanctum::actingAs($this->makeUser('supervisor'));
        $this->get('/api/admin/stipend/export')->assertForbidden();
    }

    public function test_audit_log_csv_follows_the_filters_and_has_a_limit(): void
    {
        $admin = $this->makeUser('admin', ['name' => 'DSA Admin']);
        $student = $this->makeUser('recipient', ['name' => 'Jidaya S Serie']);
        StudentProfile::create(['user_id' => $student->id, 'student_id_number' => '202385936', 'first_name' => 'J', 'last_name' => 'S', 'college' => 'CBAA', 'program' => 'BSA', 'year_level' => 2]);
        $stub = StipendHistory::create(['user_id' => $student->id, 'amount' => 5000, 'academic_year' => '2026-2027', 'semester' => '1st Semester', 'status' => 'void', 'control_number' => 'SWAP-9']);
        AuditLog::record('voided', $stub, ['status' => 'released'], ['status' => 'void', 'void_reason' => 'Duplicate'], $admin->id);
        AuditLog::record('promoted_to_recipient', $student, ['role' => 'applicant'], ['role' => 'recipient'], $admin->id);
        Sanctum::actingAs($admin);

        $rows = $this->csv($this->get('/api/admin/audit-logs/export?area=stipend'));
        $this->assertSame(AuditLogService::EXPORT_HEADINGS, $rows[0]);
        $this->assertCount(2, $rows, 'only the stipend entry');
        [$when, $area, , $action, $who, $role, $name, $sid, $record, $changes] = $rows[1];
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $when);
        $this->assertSame(['voided', 'DSA Admin', 'admin', 'Jidaya S Serie', '202385936', 'Stipend SWAP-9'], [$action, $who, $role, $name, $sid, $record]);
        $this->assertStringContainsString('Status: released → void', $changes);

        $this->assertDatabaseHas('audit_logs', ['action' => 'report_exported', 'user_id' => $admin->id]);
        $this->assertSame('audit-log', AuditLog::where('action', 'report_exported')->first()->new_values['type']);
    }

    public function test_audit_log_csv_refuses_more_than_the_limit(): void
    {
        $admin = $this->makeUser('admin');
        $now = now();
        $rows = array_fill(0, AuditLogService::EXPORT_LIMIT + 1, [
            'user_id' => $admin->id, 'action' => 'created', 'auditable_type' => \App\Models\User::class, 'auditable_id' => $admin->id, 'created_at' => $now,
        ]);
        foreach (array_chunk($rows, 2000) as $chunk) {
            \Illuminate\Support\Facades\DB::table('audit_logs')->insert($chunk);
        }
        Sanctum::actingAs($admin);

        $this->getJson('/api/admin/audit-logs/export')->assertStatus(422)
            ->assertJsonPath('message', AuditLogService::msgExportTooMany(AuditLogService::EXPORT_LIMIT + 1));
    }
}
