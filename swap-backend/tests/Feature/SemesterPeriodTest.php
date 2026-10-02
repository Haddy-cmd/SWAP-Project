<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\SemesterPeriod;
use App\Services\SemesterPeriodService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin → Semesters: the DSA calendar every term-date rule reads from. */
class SemesterPeriodTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'academic_year' => '2026-2027',
            'semester' => '1st Semester',
            'start_date' => '2026-08-10',
            'end_date' => '2026-12-18',
        ], $overrides);
    }

    public function test_admin_creates_lists_updates_and_deletes_a_period(): void
    {
        Sanctum::actingAs($admin = $this->makeUser('admin'));

        $id = $this->postJson('/api/admin/semester-periods', $this->payload())
            ->assertStatus(201)
            ->assertJsonPath('message', '1st Semester 2026-2027 saved.')
            ->assertJsonPath('data.label', '1st Semester 2026-2027')
            ->assertJsonPath('data.renewal_open', false)
            ->json('data.id');

        $this->getJson('/api/admin/semester-periods')->assertOk()->assertJsonPath('data.0.id', $id);

        $this->putJson("/api/admin/semester-periods/{$id}", $this->payload(['end_date' => '2026-12-20']))
            ->assertOk()
            ->assertJsonPath('message', '1st Semester 2026-2027 updated.')
            ->assertJsonPath('data.end_date', '2026-12-20');

        $this->deleteJson("/api/admin/semester-periods/{$id}")
            ->assertOk()->assertJsonPath('message', '1st Semester 2026-2027 deleted.');
        $this->assertDatabaseMissing('semester_periods', ['id' => $id]);

        foreach (['semester_period_created', 'semester_period_updated', 'semester_period_deleted'] as $action) {
            $this->assertTrue(AuditLog::where('action', $action)->where('user_id', $admin->id)->exists(), $action);
        }
    }

    public function test_validation_rules(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $post = fn (array $o) => $this->postJson('/api/admin/semester-periods', $this->payload($o));

        $post(['academic_year' => '2026'])->assertStatus(422)
            ->assertJsonPath('errors.academic_year.0', 'Enter the school year as two years, e.g. 2026-2027.');
        $post(['academic_year' => '2026-2028'])->assertStatus(422)
            ->assertJsonPath('errors.academic_year.0', 'The school year must be two consecutive years, e.g. 2026-2027.');
        $post(['semester' => 'Third'])->assertStatus(422)
            ->assertJsonPath('errors.semester.0', 'Choose 1st Semester, 2nd Semester or Summer.');
        $post(['end_date' => '2026-08-10'])->assertStatus(422)
            ->assertJsonPath('errors.end_date.0', 'The end date must be after the start date.');

        $post([])->assertStatus(201);

        // Same year + semester again.
        $post(['start_date' => '2027-01-05', 'end_date' => '2027-05-20'])->assertStatus(422)
            ->assertJsonPath('errors.semester.0', 'This semester of that school year is already set up.');

        // Overlapping dates with another term.
        $post(['semester' => '2nd Semester', 'start_date' => '2026-12-01', 'end_date' => '2027-05-20'])->assertStatus(422)
            ->assertJsonPath('errors.start_date.0', 'These dates overlap 1st Semester 2026-2027 (Aug 10, 2026 to Dec 18, 2026).');

        // Touching the next day is fine.
        $post(['semester' => '2nd Semester', 'start_date' => '2026-12-19', 'end_date' => '2027-05-20'])->assertStatus(201);

        // Renewal can't target a term that is already over.
        $post(['academic_year' => '2020-2021', 'start_date' => '2020-08-10', 'end_date' => '2020-12-18', 'renewal_open' => true])
            ->assertStatus(422)
            ->assertJsonPath('errors.renewal_open.0', "Renewal can only be opened for a semester that hasn't ended.");
    }

    public function test_editing_a_period_does_not_conflict_with_itself(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $id = $this->postJson('/api/admin/semester-periods', $this->payload())->assertStatus(201)->json('data.id');

        $this->putJson("/api/admin/semester-periods/{$id}", $this->payload(['start_date' => '2026-08-03']))
            ->assertOk()->assertJsonPath('data.start_date', '2026-08-03');
    }

    public function test_renewal_is_open_for_one_period_at_a_time(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $first = $this->postJson('/api/admin/semester-periods', $this->payload(['renewal_open' => true]))->json('data.id');
        $second = $this->postJson('/api/admin/semester-periods', $this->payload([
            'semester' => '2nd Semester', 'start_date' => '2027-01-11', 'end_date' => '2027-05-21', 'renewal_open' => true,
        ]))->assertStatus(201)->json('data.id');

        $this->assertFalse(SemesterPeriod::find($first)->renewal_open);
        $this->assertTrue(SemesterPeriod::find($second)->renewal_open);
        $this->assertSame($second, SemesterPeriodService::renewalTarget()->id);

        // The public application status reads the same period.
        $this->getJson('/api/settings/application-status')->assertOk()
            ->assertJsonPath('data.renewal.open', true)
            ->assertJsonPath('data.renewal.academic_year', '2026-2027')
            ->assertJsonPath('data.renewal.semester', '2nd Semester');
    }

    public function test_current_and_next_period(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $today = Carbon::now('Asia/Manila')->startOfDay();

        $this->getJson('/api/admin/semester-periods/current')->assertOk()
            ->assertJsonPath('data.current', null)
            ->assertJsonPath('data.next', null);

        SemesterPeriod::create([
            'academic_year' => '2026-2027', 'semester' => '2nd Semester',
            'start_date' => $today->copy()->addMonth()->toDateString(), 'end_date' => $today->copy()->addMonths(5)->toDateString(),
        ]);
        $this->getJson('/api/admin/semester-periods/current')->assertOk()
            ->assertJsonPath('data.current', null)
            ->assertJsonPath('data.next.semester', '2nd Semester')
            ->assertJsonPath('data.next.phase', 'upcoming');

        SemesterPeriod::create([
            'academic_year' => '2026-2027', 'semester' => '1st Semester',
            'start_date' => $today->copy()->subMonth()->toDateString(), 'end_date' => $today->copy()->addDays(10)->toDateString(),
        ]);
        $this->getJson('/api/admin/semester-periods/current')->assertOk()
            ->assertJsonPath('data.current.semester', '1st Semester')
            ->assertJsonPath('data.current.phase', 'current')
            ->assertJsonPath('data.current.days_left', 10)
            ->assertJsonPath('data.next', null);
    }

    public function test_a_period_in_use_cannot_be_deleted(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $id = $this->postJson('/api/admin/semester-periods', $this->payload(['academic_year' => '2024-2025', 'start_date' => '2024-08-12', 'end_date' => '2024-12-20']))
            ->assertStatus(201)->json('data.id');
        $this->makeAssignment($this->makeUser('recipient'), $this->makeUser('supervisor')); // 1st Semester 2024-2025

        $this->deleteJson("/api/admin/semester-periods/{$id}")
            ->assertStatus(422)->assertJsonPath('message', SemesterPeriodService::MSG_IN_USE);
        $this->assertDatabaseHas('semester_periods', ['id' => $id]);
    }

    public function test_assignment_end_date_falls_back_to_its_period(): void
    {
        $assignment = $this->makeAssignment($this->makeUser('recipient'), $this->makeUser('supervisor'));
        $this->assertNull($assignment->effectiveEndDate());

        SemesterPeriod::create([
            'academic_year' => '2024-2025', 'semester' => '1st Semester',
            'start_date' => '2024-08-12', 'end_date' => '2024-12-20',
        ]);
        $this->assertSame('2024-12-20', $assignment->fresh()->effectiveEndDate()->toDateString());

        // The assignment's own end date is an override.
        $assignment->update(['end_date' => '2024-12-27']);
        $this->assertSame('2024-12-27', $assignment->fresh()->effectiveEndDate()->toDateString());
    }

    public function test_only_admins_manage_periods(): void
    {
        foreach (['recipient', 'supervisor', 'applicant'] as $role) {
            Sanctum::actingAs($this->makeUser($role));
            $this->getJson('/api/admin/semester-periods')->assertStatus(403);
            $this->postJson('/api/admin/semester-periods', $this->payload())->assertStatus(403);
        }
        $this->assertSame(0, SemesterPeriod::count());
    }
}
