<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\StipendHistory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** A released stub is "received" the first time its recipient views or downloads it. */
class StipendReceivedTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function stub(User $recipient, string $status = StipendHistory::STATUS_RELEASED, array $attrs = []): StipendHistory
    {
        $disk = config('filesystems.documents_disk', 'public');
        Storage::disk($disk)->put("slips/{$recipient->id}.pdf", '%PDF-1.4 test');

        return StipendHistory::create(array_merge([
            'user_id' => $recipient->id, 'amount' => 5000, 'academic_year' => '2024-2025', 'semester' => '1st Semester',
            'status' => $status, 'control_number' => "SWAP-STP-TEST-{$recipient->id}", 'released_at' => now()->subDay(),
            'slip_path' => "slips/{$recipient->id}.pdf",
        ], $attrs));
    }

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('filesystems.documents_disk', 'public'));
    }

    public function test_the_first_download_marks_it_received_once(): void
    {
        $recipient = $this->makeUser('recipient');
        $stub = $this->stub($recipient);
        Sanctum::actingAs($recipient);

        $this->get("/api/recipient/stipend/{$stub->id}/slip")->assertOk()->assertDownload();
        $first = $stub->fresh()->received_at;
        $this->assertNotNull($first);
        $this->assertSame(StipendHistory::STATUS_RELEASED, $stub->fresh()->status, 'still released (voidable)');
        $log = AuditLog::where('action', 'stipend_received')->where('auditable_id', $stub->id)->firstOrFail();
        $this->assertSame($recipient->id, $log->user_id);
        $this->assertSame('download', $log->new_values['via']);

        $this->travel(2)->hours();
        $this->get("/api/recipient/stipend/{$stub->id}/slip?view=1")->assertOk();
        $this->assertEquals($first, $stub->fresh()->received_at, 'only the first opening counts');
        $this->assertSame(1, AuditLog::where('action', 'stipend_received')->count());

        $this->getJson('/api/recipient/stipend/history')->assertOk()->assertJsonPath('data.0.received_at', $first->toISOString());
    }

    public function test_viewing_inline_marks_it_too_and_others_cannot_open_it(): void
    {
        $recipient = $this->makeUser('recipient');
        $stub = $this->stub($recipient);

        Sanctum::actingAs($this->makeUser('recipient'));
        $this->get("/api/recipient/stipend/{$stub->id}/slip")->assertForbidden();
        $this->assertNull($stub->fresh()->received_at);

        Sanctum::actingAs($recipient);
        $res = $this->get("/api/recipient/stipend/{$stub->id}/slip?view=1")->assertOk();
        $this->assertStringStartsWith('inline', (string) $res->headers->get('content-disposition'));
        $this->assertNotNull($stub->fresh()->received_at);
        $this->assertSame('view', AuditLog::where('action', 'stipend_received')->value('new_values')['via']);
    }

    public function test_a_void_stub_is_never_marked(): void
    {
        $recipient = $this->makeUser('recipient');
        $stub = $this->stub($recipient, StipendHistory::STATUS_VOID, ['void_reason' => 'Wrong amount']);
        Sanctum::actingAs($recipient);

        $this->get("/api/recipient/stipend/{$stub->id}/slip")->assertNotFound();
        $this->assertNull($stub->fresh()->received_at);
    }

    public function test_admin_history_counts_and_filters_received(): void
    {
        $opened = $this->stub($this->makeUser('recipient'), StipendHistory::STATUS_RELEASED, ['received_at' => now()]);
        $this->stub($this->makeUser('recipient'));                               // released, not opened
        $legacy = $this->stub($this->makeUser('recipient'), StipendHistory::STATUS_CLAIMED); // Banking Office pickup
        $this->stub($this->makeUser('recipient'), StipendHistory::STATUS_VOID);

        Sanctum::actingAs($this->makeUser('admin'));
        $this->getJson('/api/admin/stipend?status=received')->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.summary.released', 3)
            ->assertJsonPath('meta.summary.received', 2)
            ->assertJsonPath('meta.summary.not_received', 1)
            ->assertJsonPath('meta.summary.legacy_received', 1)
            ->assertJsonPath('meta.summary.void', 1);
        $this->getJson('/api/admin/stipend?status=not_received')->assertOk()->assertJsonCount(1, 'data');
        $ids = collect($this->getJson('/api/admin/stipend?status=received')->json('data'))->pluck('id')->sort()->values()->all();
        $this->assertSame(collect([$opened->id, $legacy->id])->sort()->values()->all(), $ids);
    }
}
