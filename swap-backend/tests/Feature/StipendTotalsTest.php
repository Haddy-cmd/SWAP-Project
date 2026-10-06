<?php

namespace Tests\Feature;

use App\Models\StipendHistory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * Stipend totals: a release is final (2026-10-05), so every live stub is money released —
 * `released`, plus the legacy `claimed` (paid at the Banking Office) and `certified`
 * (migrated to released). A void stub never counts.
 */
class StipendTotalsTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function stub(User $recipient, string $status, int $amount): void
    {
        StipendHistory::create([
            'user_id' => $recipient->id,
            'amount' => $amount,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'status' => $status,
            'claimed_at' => $status === 'claimed' ? now() : null,
        ]);
    }

    private function seedStubs(): void
    {
        $this->stub($this->makeUser('recipient'), 'claimed', 5000);   // legacy: paid at the Banking Office
        $this->stub($this->makeUser('recipient'), 'released', 4000);
        $this->stub($this->makeUser('recipient'), 'certified', 3000); // legacy: ready to claim
        $this->stub($this->makeUser('recipient'), 'void', 9000);      // never counted
    }

    public function test_analytics_counts_every_live_stub_as_released_and_who_is_ready(): void
    {
        $this->seedStubs();
        $supervisor = $this->makeUser('supervisor');
        // Payable with signature + end-of-term report: ready for release.
        $ready = $this->makeAssignment($this->makeUser('recipient'), $supervisor, null, ['required_hours' => 2]);
        $this->makeClosedLog($ready, 2);
        $this->submitTermReport($ready);
        // Payable, report not in yet: not ready.
        $this->makeClosedLog($this->makeAssignment($this->makeUser('recipient'), $supervisor, null, ['required_hours' => 2]), 2);
        Sanctum::actingAs($this->makeUser('admin'));

        $res = $this->getJson('/api/admin/analytics/overview?academic_year=2024-2025&semester=1st%20Semester')
            ->assertOk()
            ->assertJsonPath('data.stipend_summary.total_released', 12000)
            ->assertJsonPath('data.stipend_summary.ready_to_release', 1);
        $this->assertArrayNotHasKey('total_pending', $res->json('data.stipend_summary'));
    }

    public function test_disbursement_report_counts_every_live_stub_as_released(): void
    {
        $this->seedStubs();
        Sanctum::actingAs($this->makeUser('admin'));

        $stats = collect(
            $this->getJson('/api/admin/reports/stipend?academic_year=2024-2025&semester=1st%20Semester')
                ->assertOk()
                ->json('data.stats')
        )->pluck('value', 'label');

        $this->assertSame('₱12,000', $stats['Total Released']);
        $this->assertSame('3', $stats['Recipients']);
        $this->assertSame('0', $stats['Via Promissory']);
        $this->assertSame('1', $stats['Voided']);
    }

    public function test_recipient_history_returns_every_stub_when_asked(): void
    {
        $recipient = $this->makeUser('recipient');
        foreach (range(1, 20) as $i) {
            // One stub per period, so the one-live-per-period index is respected.
            StipendHistory::create([
                'user_id' => $recipient->id,
                'amount' => 5000,
                'academic_year' => (2000 + $i) . '-' . (2001 + $i),
                'semester' => '1st Semester',
                'status' => 'claimed',
            ]);
        }
        Sanctum::actingAs($recipient);

        $this->getJson('/api/recipient/stipend/history?per_page=100')->assertOk()->assertJsonCount(20, 'data');
        // The default page stays small for any other caller.
        $this->getJson('/api/recipient/stipend/history')->assertOk()->assertJsonCount(15, 'data');
        $this->getJson('/api/recipient/stipend/history?per_page=101')->assertStatus(422);
    }
}
