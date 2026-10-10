<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\AuditLog;
use App\Models\StipendHistory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin → Audit Logs: who each entry is about, filters, readable entries, one record's history. */
class AuditLogTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function asAdmin(): User
    {
        Sanctum::actingAs($admin = $this->makeUser('admin'));

        return $admin;
    }

    private function logs(array $params = []): array
    {
        return $this->getJson('/api/admin/audit-logs?' . http_build_query($params))->assertOk()->json();
    }

    public function test_each_entry_knows_which_student_it_is_about(): void
    {
        $student = $this->makeUser('recipient');
        $admin = $this->makeUser('admin');
        $assignment = $this->makeAssignment($student, $this->makeUser('supervisor'));
        $log = $this->makeClosedLog($assignment, 3, 'pending_verification');
        $application = Application::create(['user_id' => $student->id, 'academic_year' => '2024-2025', 'semester' => '1st Semester', 'status' => 'submitted']);

        $this->assertSame($student->id, AuditLog::record('verified', $log)->subject_user_id);
        $this->assertSame($student->id, AuditLog::record('updated', $application)->subject_user_id);
        $this->assertSame($student->id, AuditLog::record('profile_updated', $student)->subject_user_id);
        // The account acting on itself (an export) is about no one.
        $this->assertNull(AuditLog::record('report_exported', $admin)->subject_user_id);
        $interview = $application->interview()->create(['scheduled_at' => now()->addDay(), 'mode' => 'in_person', 'location' => 'DSA']);
        $this->assertSame($student->id, AuditLog::record('updated', $interview)->subject_user_id, 'through the application');
    }

    public function test_entries_read_as_sentences_with_what_changed(): void
    {
        $student = $this->makeUser('recipient', ['name' => 'Ana Cruz']);
        $admin = $this->makeUser('admin', ['name' => 'Dean Admin']);
        $stub = StipendHistory::create(['user_id' => $student->id, 'amount' => 5000, 'academic_year' => '2024-2025',
            'semester' => '1st Semester', 'status' => 'released', 'control_number' => 'SWAP-STP-1']);
        AuditLog::record('released', $stub, null, ['status' => 'released', 'control_number' => 'SWAP-STP-1', 'amount' => '5000.00'], $admin->id);
        AuditLog::record('voided', $stub, ['status' => 'released'], ['status' => 'void', 'void_reason' => 'Duplicate'], $admin->id);
        AuditLog::record('promoted_to_recipient', $student, ['role' => 'applicant'], ['role' => 'recipient'], $admin->id);
        AuditLog::record('report_exported', $admin, null, ['type' => 'term-results', 'format' => 'pdf', 'rows' => 12], $admin->id);
        $assignment = $this->makeAssignment($student, $this->makeUser('supervisor'));
        AuditLog::record('created', $assignment, null, ['required_hours' => 200, 'qr_secret' => 'SECRET'], $admin->id);

        $this->asAdmin();
        $rows = collect($this->logs()['data'])->keyBy('action');

        $this->assertSame('Released stipend SWAP-STP-1 (₱5,000.00) to Ana Cruz', $rows['released']['summary']);
        $this->assertSame('stipend', $rows['released']['area']);
        $this->assertSame(['id' => $admin->id, 'name' => 'Dean Admin', 'role' => 'admin'], $rows['released']['actor']);
        $this->assertSame('Ana Cruz', $rows['released']['subject']['name']);
        $this->assertSame('Voided stipend SWAP-STP-1 — Duplicate', $rows['voided']['summary']);
        $this->assertTrue($rows['voided']['sensitive']);
        $this->assertContains(['field' => 'Status', 'before' => 'released', 'after' => 'void'], $rows['voided']['changes']);
        $this->assertSame('Made Ana Cruz a recipient (application approved)', $rows['promoted_to_recipient']['summary']);
        $this->assertSame('Exported the Term Results report (PDF, 12 rows)', $rows['report_exported']['summary']);
        $this->assertStringStartsWith('Created placement', $rows['created']['summary']);
        // Secrets never show.
        $this->assertNotContains('SECRET', collect($rows['created']['changes'])->pluck('after')->all());
        $this->assertSame("stipend:{$stub->id}", $rows['released']['record']);
    }

    public function test_filters_narrow_the_log(): void
    {
        $ana = $this->makeUser('recipient', ['name' => 'Ana Cruz']);
        $ben = $this->makeUser('recipient', ['name' => 'Ben Lim']);
        $supervisor = $this->makeUser('supervisor');
        $admin = $this->makeUser('admin');
        $log = $this->makeClosedLog($this->makeAssignment($ana, $supervisor), 2, 'pending_verification');
        AuditLog::record('verified', $log, null, null, $supervisor->id);
        AuditLog::record('deleted', $ben, null, null, $admin->id);
        $old = AuditLog::record('profile_updated', $ben, null, null, $ben->id);
        DB::table('audit_logs')->where('id', $old->id)->update(['created_at' => now()->subDays(10)]);

        $this->asAdmin();
        $this->assertSame(3, $this->logs()['meta']['total']);
        $this->assertSame(['verified'], array_column($this->logs(['area' => 'hours'])['data'], 'action'));
        $this->assertSame(['verified'], array_column($this->logs(['actor_id' => $supervisor->id])['data'], 'action'));
        $this->assertSame(['deleted', 'profile_updated'], array_column($this->logs(['subject' => 'ben'])['data'], 'action'));
        $this->assertSame(['deleted'], array_column($this->logs(['sensitive' => 1])['data'], 'action'));
        $this->assertSame(['profile_updated'], array_column($this->logs(['to' => now('Asia/Manila')->subDays(5)->toDateString()])['data'], 'action'));
        $this->assertSame(['deleted', 'verified'], array_column($this->logs(['from' => now('Asia/Manila')->subDay()->toDateString()])['data'], 'action'));
        $this->assertSame(['verified'], array_column($this->logs(['subject_user_id' => $ana->id])['data'], 'action'));

        $this->getJson('/api/admin/audit-logs?area=nope')->assertStatus(422);
        $this->getJson('/api/admin/audit-logs?record=password:1')->assertStatus(422);
    }

    public function test_system_testing_entries_are_hidden_unless_asked_for(): void
    {
        $picked = $this->makeUser('recipient');
        $admin = $this->makeUser('admin');
        $picked->forceFill(['testing_added_at' => now()->subHour()])->save();
        AuditLog::record('testing_account_added', $picked, null, null, $admin->id);
        AuditLog::record('profile_updated', $picked, null, null, $picked->id); // made while being tested
        AuditLog::record('deleted', $this->makeUser('recipient'), null, null, $admin->id);

        $this->asAdmin();
        $this->assertSame(['deleted'], array_column($this->logs()['data'], 'action'));
        $this->assertSame(3, $this->logs(['include_testing' => 1])['meta']['total']);
        $this->assertSame(['testing_account_added'], array_column($this->logs(['area' => 'testing'])['data'], 'action'));
        // A record's own history shows everything.
        $this->assertSame(2, $this->logs(['subject_user_id' => $picked->id])['meta']['total']);
    }

    public function test_one_records_history_and_the_options(): void
    {
        $student = $this->makeUser('recipient');
        $admin = $this->makeUser('admin', ['name' => 'Dean Admin']);
        $application = Application::create(['user_id' => $student->id, 'academic_year' => '2024-2025', 'semester' => '1st Semester', 'status' => 'submitted']);
        AuditLog::record('created', $application, null, ['status' => 'submitted'], $student->id);
        AuditLog::record('updated', $application, ['status' => 'submitted'], ['status' => 'approved'], $admin->id);
        AuditLog::record('profile_updated', $student, null, null, $student->id);

        $this->asAdmin();
        $rows = $this->logs(['record' => "application:{$application->id}"])['data'];
        $this->assertSame(['updated', 'created'], array_column($rows, 'action'));
        $this->assertSame("Approved application #{$application->id} · new · 1st Semester 2024-2025", $rows[0]['summary']);

        $options = $this->getJson('/api/admin/audit-logs/options')->assertOk()->json('data');
        $this->assertContains(['key' => 'stipend', 'label' => 'Stipend'], $options['areas']);
        $this->assertContains(['id' => $admin->id, 'name' => 'Dean Admin', 'role' => 'admin'], $options['actors']);
    }

    public function test_only_admins_read_the_log(): void
    {
        Sanctum::actingAs($this->makeUser('supervisor'));
        $this->getJson('/api/admin/audit-logs')->assertForbidden();
        $this->getJson('/api/admin/audit-logs/options')->assertForbidden();
    }

    public function test_the_migration_fills_in_who_older_entries_are_about(): void
    {
        $student = $this->makeUser('recipient');
        $log = $this->makeClosedLog($this->makeAssignment($student, $this->makeUser('supervisor')), 2);
        $row = AuditLog::record('verified', $log);
        $profile = AuditLog::record('profile_updated', $student);
        DB::table('audit_logs')->update(['subject_user_id' => null]);

        $migration = require database_path('migrations/2026_10_09_000002_add_subject_user_id_to_audit_logs.php');
        \Illuminate\Support\Facades\Schema::table('audit_logs', fn ($t) => $t->dropConstrainedForeignId('subject_user_id'));
        $migration->up();

        $this->assertSame($student->id, $row->fresh()->subject_user_id);
        $this->assertSame($student->id, $profile->fresh()->subject_user_id);
    }
}
