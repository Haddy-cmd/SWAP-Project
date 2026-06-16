<?php

namespace Tests\Unit;

use App\Services\QrCodeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

class QrCodeServiceTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function service(): QrCodeService
    {
        return app(QrCodeService::class);
    }

    public function test_generate_returns_non_empty_signed_token(): void
    {
        $a = $this->makeAssignment($this->makeUser('recipient'), $this->makeUser('supervisor'));
        $token = $this->service()->generateForAssignment($a);

        $this->assertNotEmpty($token);
        $this->assertStringContainsString('.', $token);
    }

    public function test_validate_returns_assignment_for_fresh_token(): void
    {
        $a = $this->makeAssignment($this->makeUser('recipient'), $this->makeUser('supervisor'));
        $token = $this->service()->generateForAssignment($a);

        $resolved = $this->service()->validate($token);

        $this->assertNotNull($resolved);
        $this->assertEquals($a->id, $resolved->id);
    }

    public function test_validate_rejects_tampered_signature(): void
    {
        $a = $this->makeAssignment($this->makeUser('recipient'), $this->makeUser('supervisor'));
        $token = $this->service()->generateForAssignment($a);

        $last = $token[strlen($token) - 1];
        $tampered = substr($token, 0, -1).($last === 'a' ? 'b' : 'a');

        $this->assertNull($this->service()->validate($tampered));
    }

    public function test_validate_rejects_empty_string(): void
    {
        $this->assertNull($this->service()->validate(''));
    }

    public function test_token_is_bound_to_its_own_assignment(): void
    {
        $sup = $this->makeUser('supervisor');
        $a = $this->makeAssignment($this->makeUser('recipient'), $sup);
        $b = $this->makeAssignment($this->makeUser('recipient'), $sup);

        $tokenA = $this->service()->generateForAssignment($a);
        $resolved = $this->service()->validate($tokenA);

        $this->assertEquals($a->id, $resolved->id);
        $this->assertNotEquals($b->id, $resolved->id);
    }

    public function test_regenerate_invalidates_old_token(): void
    {
        $a = $this->makeAssignment($this->makeUser('recipient'), $this->makeUser('supervisor'));
        $oldToken = $this->service()->generateForAssignment($a);

        $this->service()->regenerateSecret($a->fresh());

        $this->assertNull($this->service()->validate($oldToken));
    }
}
