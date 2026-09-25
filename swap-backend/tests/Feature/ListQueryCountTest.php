<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * Admin list pages must not issue queries per row (audit R13): the query count
 * for a page of many rows equals the count for a page of a few.
 */
class ListQueryCountTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function queriesFor(string $url): int
    {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson($url)->assertOk();
        $count = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $count;
    }

    private function addAssignments(int $n): void
    {
        $office = $this->makeOffice();
        $this->makeUser('supervisor', ['office_id' => $office->id]); // an office co-supervisor
        for ($i = 0; $i < $n; $i++) {
            $recipient = $this->makeUser('recipient');
            $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'), $office);
            $log = $this->makeOpenLog($assignment, $recipient, now()->subHours(3));
            $log->update(['time_out' => now(), 'status' => 'verified']);
        }
    }

    private function addApplicationsWithHistory(int $n): void
    {
        for ($i = 0; $i < $n; $i++) {
            $application = Application::create([
                'user_id' => $this->makeUser('applicant')->id,
                'academic_year' => '2024-2025',
                'semester' => '1st Semester',
                'status' => 'interview_scheduled',
            ]);
            $interview = $application->interview()->create([
                'scheduled_at' => now()->addDays(3), 'mode' => 'in_person', 'location' => 'DSA Office',
            ]);
            AuditLog::record('rescheduled', $interview, ['scheduled_at' => null], ['scheduled_at' => null]);
        }
    }

    public function test_assignment_list_query_count_does_not_grow_with_rows(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));

        $this->addAssignments(2);
        $few = $this->queriesFor('/api/admin/assignments');

        $this->addAssignments(12);
        $many = $this->queriesFor('/api/admin/assignments');

        $this->assertSame($few, $many, "assignments list: {$few} queries for 2 rows, {$many} for 14");
        $this->assertLessThanOrEqual(12, $many);
    }

    public function test_application_list_query_count_does_not_grow_with_rows(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));

        $this->addApplicationsWithHistory(2);
        $few = $this->queriesFor('/api/admin/applications');

        $this->addApplicationsWithHistory(12);
        $many = $this->queriesFor('/api/admin/applications');

        $this->assertSame($few, $many, "applications list: {$few} queries for 2 rows, {$many} for 14");
        $this->assertLessThanOrEqual(12, $many);
    }

    public function test_the_eager_loaded_selfie_rule_matches_the_query(): void
    {
        $office = $this->makeOffice();
        $coSupervisor = $this->makeUser('supervisor', ['office_id' => $office->id, 'require_clock_in_selfie' => false]);
        $assignment = $this->makeAssignment($this->makeUser('recipient'), $this->makeUser('supervisor'), $office);

        $queried = $assignment->fresh()->governingSupervisors()->pluck('id')->sort()->values();
        $loaded = $assignment->fresh(['supervisor', 'office.supervisors'])->governingSupervisors()->pluck('id')->sort()->values();

        $this->assertEquals($queried, $loaded);
        $this->assertContains($coSupervisor->id, $loaded);
    }
}
