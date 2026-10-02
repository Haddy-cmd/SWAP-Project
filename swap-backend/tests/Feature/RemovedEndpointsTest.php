<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Features that were removed stay removed. */
class RemovedEndpointsTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_duty_slip_verification_is_gone(): void
    {
        // Paper duty slips are not official records; the control number is printed for reference only.
        Sanctum::actingAs($this->makeUser('admin'));
        $this->getJson('/api/admin/duty-slip/verify?control_no=SWAP-202512345-2627S1-SEM-ABC123')->assertStatus(404);
    }
}
