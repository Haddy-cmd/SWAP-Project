<?php

namespace Tests\Feature;

use App\Models\Office;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The one-time copy of the development offices into the live database. */
class OfficeCopyMigrationTest extends TestCase
{
    use RefreshDatabase;

    private const NAMES = [
        'Division of Student Affairs',
        'University Library',
        'Office of the Registrar',
        'Information and Communication Technology Center',
        'University Banking Office',
        'Campo Ranao St.',
    ];

    public function test_the_offices_arrive_with_their_map_pins_and_settings(): void
    {
        $this->assertSame(6, Office::whereIn('name', self::NAMES)->count());

        $dsa = Office::firstWhere('name', 'Division of Student Affairs');
        $this->assertEqualsWithDelta(7.99907699, (float) $dsa->latitude, 1e-8);
        $this->assertEqualsWithDelta(124.25887191, (float) $dsa->longitude, 1e-8);
        $this->assertSame(50, $dsa->radius_meters);
        $this->assertTrue($dsa->geofence_enabled);
        $this->assertTrue($dsa->auto_clock_out);
        $this->assertNull($dsa->qr_secret, 'a fresh QR is generated on first use');

        $this->assertFalse(Office::firstWhere('name', 'University Banking Office')->is_active);
        $this->assertSame(20, Office::firstWhere('name', 'Campo Ranao St.')->radius_meters);
    }

    public function test_running_it_again_neither_duplicates_nor_overwrites_live_edits(): void
    {
        $library = Office::firstWhere('name', 'University Library');
        $library->update(['max_recipients' => 7, 'head_name' => 'Edited on the live site']);
        Office::firstWhere('name', 'Office of the Registrar')->update(['name' => 'OFFICE OF THE REGISTRAR']);

        (require database_path('migrations/2026_09_29_000001_copy_offices_from_local.php'))->up();

        $this->assertSame(1, Office::where('name', 'University Library')->count());
        $this->assertSame(7, $library->fresh()->max_recipients);
        $this->assertSame('Edited on the live site', $library->fresh()->head_name);
        // Name match ignores letter case.
        $this->assertSame(0, Office::where('name', 'Office of the Registrar')->count());
    }
}
