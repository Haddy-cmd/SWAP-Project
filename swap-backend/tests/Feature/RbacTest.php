<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

class RbacTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public static function forbiddenMatrix(): array
    {
        return [
            'applicant -> admin'        => ['applicant', '/api/admin/applications'],
            'applicant -> supervisor'   => ['applicant', '/api/supervisor/students'],
            'recipient -> admin'        => ['recipient', '/api/admin/applications'],
            'supervisor -> admin'       => ['supervisor', '/api/admin/applications'],
            'supervisor -> applicant'   => ['supervisor', '/api/applicant/applications'],
            'admin -> applicant'        => ['admin', '/api/applicant/applications'],
            'admin -> recipient'        => ['admin', '/api/recipient/hours/summary'],
        ];
    }

    /**
     * @dataProvider forbiddenMatrix
     */
    public function test_role_is_blocked_from_other_prefixes(string $role, string $uri): void
    {
        Sanctum::actingAs($this->makeUser($role));
        $this->getJson($uri)->assertStatus(403);
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/admin/applications')->assertStatus(401);
        $this->getJson('/api/applicant/applications')->assertStatus(401);
        $this->getJson('/api/profile')->assertStatus(401);
    }

    public function test_authorized_role_reaches_its_own_prefix(): void
    {
        Sanctum::actingAs($this->makeUser('admin'));
        $this->getJson('/api/admin/applications')->assertStatus(200);
    }
}
