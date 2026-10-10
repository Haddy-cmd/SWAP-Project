<?php

namespace Tests\Feature;

use App\Models\Application;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin → Assignments: the "needs an office" queue and the assigned list's search run server-side. */
class AssignmentQueueFiltersTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function application(int $userId, string $status, string $year = '2024-2025'): Application
    {
        return Application::create([
            'user_id' => $userId, 'academic_year' => $year, 'semester' => '1st Semester',
            'status' => $status, 'type' => 'new',
        ]);
    }

    public function test_unassigned_lists_approved_applicants_without_an_office_for_that_term(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $waiting = $this->makeUser('recipient');
        $placed = $this->makeUser('recipient');
        $placedLastTerm = $this->makeUser('recipient');
        $reviewing = $this->makeUser('applicant');

        $a = $this->application($waiting->id, 'approved');
        $this->application($placed->id, 'approved');
        $this->makeAssignment($placed, $supervisor);
        // Placed in an earlier term only: still needs an office for this one.
        $b = $this->application($placedLastTerm->id, 'approved');
        $this->makeAssignment($placedLastTerm, $supervisor, null, ['academic_year' => '2023-2024', 'status' => 'completed']);
        $this->application($reviewing->id, 'under_review');

        Sanctum::actingAs($this->makeUser('admin'));
        $ids = collect($this->getJson('/api/admin/applications?unassigned=1')->assertOk()->json('data'))->pluck('id')->sort()->values()->all();

        $this->assertSame(collect([$a->id, $b->id])->sort()->values()->all(), $ids);
    }

    public function test_assignments_can_be_searched_by_name_email_or_student_id(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $maria = $this->makeUser('recipient', ['name' => 'Maria Santos']);
        $jose = $this->makeUser('recipient', ['name' => 'Jose Rizal']);
        $this->makeAssignment($maria, $supervisor);
        $this->makeAssignment($jose, $supervisor);

        Sanctum::actingAs($this->makeUser('admin'));
        $this->getJson('/api/admin/assignments?search=santos')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.user_id', $maria->id)->assertJsonPath('meta.total', 1);
        $this->getJson('/api/admin/assignments')->assertOk()->assertJsonPath('meta.total', 2);
    }

    public function test_the_office_list_carries_its_supervisors_and_can_return_every_office(): void
    {
        $office = $this->makeOffice(['name' => 'AAA Library']);
        $this->makeUser('supervisor', ['name' => 'Zed', 'office_id' => $office->id]);
        $this->makeUser('supervisor', ['name' => 'Ana', 'office_id' => $office->id]);
        for ($i = 0; $i < 16; $i++) {
            $this->makeOffice(['name' => "Office {$i}"]);
        }

        Sanctum::actingAs($this->makeUser('admin'));
        $this->getJson('/api/admin/offices')->assertOk()->assertJsonCount(15, 'data');
        $all = $this->getJson('/api/admin/offices?per_page=100')->assertOk();
        // Every office on one page (making users may add offices of their own).
        $this->assertCount($all->json('meta.total'), $all->json('data'));
        $this->assertGreaterThan(15, $all->json('meta.total'));
        $all->assertJsonPath('data.0.name', 'AAA Library')
            ->assertJsonPath('data.0.supervisors.0.name', 'Ana')
            ->assertJsonPath('data.0.supervisors.1.name', 'Zed');
    }
}
