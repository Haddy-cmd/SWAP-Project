<?php

namespace Tests\Feature;

use App\Models\Office;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** The one-time addition of the college and campus offices. */
class OfficeAddCollegesMigrationTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private const FILE = 'migrations/2026_10_11_000005_add_college_and_campus_offices.php';

    private function names(): array
    {
        return (require database_path(self::FILE))::NAMES;
    }

    public function test_the_offices_arrive_once_with_names_only(): void
    {
        $names = $this->names();
        $this->assertCount(18, $names);
        $this->assertSame(18, Office::whereIn('name', $names)->count());

        $coa = Office::firstWhere('name', 'College of Agriculture');
        $this->assertTrue($coa->is_active);
        $this->assertSame(50, $coa->max_recipients);
        $this->assertNull($coa->latitude);
        $this->assertFalse($coa->geofence_enabled, 'no map pin until the admin sets one');
        $this->assertNull($coa->qr_secret, 'a fresh QR is generated on first use');

        // The existing Library and Registrar are not duplicated.
        $this->assertSame(1, Office::where('name', 'University Library')->count());
        $this->assertSame(1, Office::where('name', 'Office of the Registrar')->count());
    }

    public function test_the_offices_page_gets_every_office_past_the_default_page(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $all = Office::count();
        $this->assertGreaterThan(15, $all);

        // Admin → Offices and the invite picker ask for per_page=100 (the API's cap).
        $this->getJson('/api/admin/offices?per_page=100')->assertOk()
            ->assertJsonCount($all, 'data')->assertJsonPath('meta.total', $all);
        $this->getJson('/api/admin/offices')->assertOk()->assertJsonCount(15, 'data');
    }

    public function test_running_it_again_neither_duplicates_nor_overwrites_live_edits(): void
    {
        $coa = Office::firstWhere('name', 'College of Agriculture');
        $coa->update(['max_recipients' => 7, 'head_name' => 'Edited on the live site']);
        Office::firstWhere('name', 'Scholarship Center')->update(['name' => 'SCHOLARSHIP CENTER']);

        (require database_path(self::FILE))->up();

        $this->assertSame(1, Office::where('name', 'College of Agriculture')->count());
        $this->assertSame(7, $coa->fresh()->max_recipients);
        $this->assertSame('Edited on the live site', $coa->fresh()->head_name);
        // Name match ignores letter case.
        $this->assertSame(0, Office::where('name', 'Scholarship Center')->count());
    }
}
