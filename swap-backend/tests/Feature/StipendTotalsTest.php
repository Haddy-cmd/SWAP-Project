<?php

namespace Tests\Feature;

use App\Models\StipendHistory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * Stipend totals follow the Option C lifecycle: a stub is paid once claimed
 * (legacy rows say "released") and awaits claim while certified. Before this,
 * both aggregates counted only the legacy statuses and showed ₱0.
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
        $this->stub($this->makeUser('recipient'), 'claimed', 5000);
        $this->stub($this->makeUser('recipient'), 'released', 4000); // legacy paid
        $this->stub($this->makeUser('recipient'), 'certified', 3000);
        $this->stub($this->makeUser('recipient'), 'void', 9000);     // never counted
    }

    public function test_analytics_counts_claimed_as_paid_and_certified_as_awaiting(): void
    {
        $this->seedStubs();
        Sanctum::actingAs($this->makeUser('admin'));

        $this->getJson('/api/admin/analytics/overview?academic_year=2024-2025&semester=1st%20Semester')
            ->assertOk()
            ->assertJsonPath('data.stipend_summary.total_released', 9000)
            ->assertJsonPath('data.stipend_summary.total_pending', 3000);
    }

    public function test_disbursement_report_counts_claimed_as_paid_and_certified_as_awaiting(): void
    {
        $this->seedStubs();
        Sanctum::actingAs($this->makeUser('admin'));

        $stats = collect(
            $this->getJson('/api/admin/reports/preview?type=stipend&academic_year=2024-2025&semester=1st%20Semester')
                ->assertOk()
                ->json('data.stats')
        )->pluck('value', 'label');

        $this->assertSame('₱9,000', $stats['Total Claimed']);
        $this->assertSame('₱3,000', $stats['Awaiting Claim']);
        $this->assertSame('2', $stats['Claimed']);
        $this->assertSame('3', $stats['Recipients']);
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
