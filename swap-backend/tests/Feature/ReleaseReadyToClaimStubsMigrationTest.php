<?php

namespace Tests\Feature;

use App\Models\StipendHistory;
use App\Models\StipendSignature;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * 2026_10_05_000004: the claim QR / Banking Office step is retired, so stubs still waiting
 * to be claimed become Released with the student's signature and no QR.
 */
class ReleaseReadyToClaimStubsMigrationTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('filesystems.documents_disk', 'public'));
    }

    private function runMigration(): void
    {
        (require database_path('migrations/2026_10_05_000004_release_ready_to_claim_stubs.php'))->up();
    }

    private function stub(string $status, array $attrs = []): StipendHistory
    {
        return StipendHistory::forceCreate(array_merge([
            'user_id' => $this->makeUser('recipient')->id,
            'amount' => 5000,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'status' => $status,
            'control_number' => 'SWAP-STP-'.uniqid(),
        ], $attrs));
    }

    public function test_ready_to_claim_stubs_become_released_with_the_students_signature(): void
    {
        $admin = $this->makeUser('admin');
        $certifiedAt = now()->subDays(3)->startOfSecond();
        $ready = $this->stub('certified', [
            'certified_at' => $certifiedAt, 'certified_by' => $admin->id,
            'claim_token' => 'old-qr-token', 'slip_path' => 'stipend-slips/1/claim-stub.pdf',
        ]);
        // A recipient who never saved a specimen keeps a typed beneficiary line.
        $noSpecimen = $this->makeUser('recipient', ['signature_image_path' => null]);
        $legacyPending = $this->stub('pending', ['user_id' => $noSpecimen->id, 'claim_token' => 'older-token']);
        // Not touched: received at the Banking Office, void, already released.
        $claimed = $this->stub('claimed', ['claimed_at' => now()->subWeek(), 'releasing_officer_name' => 'Cashier']);
        $void = $this->stub('void', ['voided_at' => now()]);
        $released = $this->stub('released', ['released_at' => now()->subMonth()]);

        $this->runMigration();

        $ready->refresh();
        $this->assertSame('released', $ready->status);
        $this->assertTrue($ready->released_at->eq($certifiedAt));
        $this->assertSame($admin->id, $ready->released_by);
        $this->assertNull($ready->claim_token, 'the QR is gone');
        $this->assertNull($ready->slip_path, 'the next download re-renders without the QR');
        $ink = StipendSignature::where('stipend_history_id', $ready->id)->where('signatory_role', 'beneficiary')->sole();
        $this->assertSame('drawn', $ink->method);
        $this->assertSame("stipend-signatures/{$ready->id}/beneficiary.png", $ink->signature_image_path);
        Storage::disk(config('filesystems.documents_disk', 'public'))->assertExists($ink->signature_image_path);
        $this->assertDatabaseHas('audit_logs', ['action' => 'released', 'auditable_id' => $ready->id, 'user_id' => null]);

        $legacyPending->refresh();
        $this->assertSame('released', $legacyPending->status);
        $this->assertNotNull($legacyPending->released_at);
        $this->assertNull($legacyPending->claim_token);
        $this->assertDatabaseHas('stipend_signatures', [
            'stipend_history_id' => $legacyPending->id, 'signatory_role' => 'beneficiary',
            'method' => 'authenticated', 'signature_image_path' => null, 'printed_name' => $noSpecimen->name,
        ]);
        $html = view('stipend.slip', ['stipend' => $legacyPending->load(['recipient.profile', 'signatures.user', 'certifiedBy'])])->render();
        $this->assertStringContainsString($noSpecimen->name, $html);
        $this->assertStringNotContainsString('data:image', $html);

        $this->assertSame('claimed', $claimed->fresh()->status);
        $this->assertSame('Cashier', $claimed->fresh()->releasing_officer_name);
        $this->assertSame('void', $void->fresh()->status);
        $this->assertTrue($released->fresh()->released_at->eq($released->released_at));
        $this->assertSame(0, StipendSignature::whereIn('stipend_history_id', [$claimed->id, $void->id, $released->id])->count());
        $this->assertSame(2, \App\Models\AuditLog::where('action', 'released')->count());

        // Running it again changes nothing.
        $this->runMigration();
        $this->assertSame(2, StipendSignature::where('signatory_role', 'beneficiary')->count());
        $this->assertSame(2, \App\Models\AuditLog::where('action', 'released')->count());

        // The student downloads a fresh stub.
        Sanctum::actingAs($ready->recipient);
        $this->get("/api/recipient/stipend/{$ready->id}/slip")->assertOk();
        $this->assertNotNull($ready->fresh()->slip_path);
    }
}
