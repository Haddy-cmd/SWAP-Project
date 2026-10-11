<?php

namespace Tests\Feature;

use App\Models\StipendHistory;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin → Stipend filters: term, college, promissory only, search, and History sort. */
class StipendFiltersTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function recipient(string $name, string $college): User
    {
        $user = $this->makeUser('recipient', ['name' => $name]);
        StudentProfile::create([
            'user_id' => $user->id, 'student_id_number' => (string) random_int(100000000, 999999999),
            'first_name' => $name, 'last_name' => 'Test', 'college' => $college, 'program' => 'BS Test', 'year_level' => 2,
        ]);

        return $user;
    }

    private function stub(User $u, string $year, string $sem, int $amount, string $released, bool $promissory = false): StipendHistory
    {
        return StipendHistory::create([
            'user_id' => $u->id, 'amount' => $amount, 'academic_year' => $year, 'semester' => $sem,
            'status' => 'released', 'released_at' => $released, 'via_promissory' => $promissory,
        ]);
    }

    private function names(string $query): array
    {
        return collect($this->getJson('/api/admin/stipend' . $query)->assertOk()->json('data'))
            ->pluck('recipient.name')->all();
    }

    public function test_term_college_promissory_and_sort(): void
    {
        $ana = $this->recipient('Ana', 'COA');
        $ben = $this->recipient('Ben', 'CFAS');
        $cy = $this->recipient('Cy', 'COA');
        $this->stub($ana, '2024-2025', '1st Semester', 5000, '2024-12-01');
        $this->stub($ben, '2024-2025', '2nd Semester', 3000, '2025-05-01', true);
        $this->stub($cy, '2025-2026', '1st Semester', 4000, '2025-12-01');
        Sanctum::actingAs($this->makeUser('admin'));

        // Term: the list and the cards narrow together.
        $this->getJson('/api/admin/stipend?academic_year=2024-2025&semester=2nd%20Semester')->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.recipient.name', 'Ben')
            ->assertJsonPath('meta.summary.paid_out', 3000);

        $this->assertSame(['Cy', 'Ana'], $this->names('?college=COA'));
        $this->assertSame(['Ben'], $this->names('?promissory=1'));

        // Sorts: newest released (default), oldest, amount, name.
        $this->assertSame(['Cy', 'Ben', 'Ana'], $this->names(''));
        $this->assertSame(['Ana', 'Ben', 'Cy'], $this->names('?sort=old'));
        $this->assertSame(['Ana', 'Cy', 'Ben'], $this->names('?sort=amount'));
        $this->assertSame(['Ana', 'Ben', 'Cy'], $this->names('?sort=name'));
        $this->getJson('/api/admin/stipend?sort=random')->assertStatus(422);
    }

    public function test_terms_are_newest_first_and_include_unpaid_placements(): void
    {
        $this->stub($this->recipient('Ana', 'COA'), '2024-2025', '1st Semester', 5000, '2024-12-01');
        $this->stub($this->recipient('Ben', 'COA'), '2024-2025', '2nd Semester', 5000, '2025-05-01');
        // A current placement with no stub yet: its term is offered too, and its row carries the college.
        $dee = $this->recipient('Dee', 'CFAS');
        $placement = $this->makeAssignment($dee, $this->makeUser('supervisor'), null, [
            'academic_year' => '2025-2026', 'semester' => '1st Semester', 'required_hours' => 2,
        ]);
        $this->makeClosedLog($placement, 2);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->getJson('/api/admin/stipend')->assertOk()->assertJsonPath('meta.terms', [
            ['academic_year' => '2025-2026', 'semester' => '1st Semester'],
            ['academic_year' => '2024-2025', 'semester' => '2nd Semester'],
            ['academic_year' => '2024-2025', 'semester' => '1st Semester'],
        ]);
        $this->getJson('/api/admin/stipend/eligible')->assertOk()
            ->assertJsonFragment(['user_id' => $dee->id, 'college' => 'CFAS']);
    }
}
