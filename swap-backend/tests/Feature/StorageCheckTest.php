<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin → System Testing → File storage: where uploads go, a live probe, image links, lost files. */
class StorageCheckTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_admin_sees_the_disk_the_probe_and_the_links(): void
    {
        config(['app.url' => 'http://localhost']);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->getJson('/api/admin/storage-check')->assertStatus(200)
            ->assertJsonPath('data.disk.name', 'public')
            ->assertJsonPath('data.disk.durable', false)
            ->assertJsonPath('data.probe.ok', true)
            ->assertJsonPath('data.links.warning', null);
        $this->assertSame([], Storage::disk('public')->allFiles('storage-check'), 'the probe cleans up after itself');

        // Image links built for another address are flagged with the fix.
        config(['app.url' => 'https://old-api.example.com']);
        $this->getJson('/api/admin/storage-check')
            ->assertJsonPath('data.links.warning', 'Image links point to https://old-api.example.com, but this server is localhost. Set APP_URL on Render to https://localhost.');
    }

    public function test_lists_accounts_whose_signature_or_photo_is_gone(): void
    {
        $kept = $this->makeUser('recipient', ['avatar_path' => 'avatars/kept.jpg']);
        Storage::disk('public')->put('avatars/kept.jpg', 'x');
        $lost = $this->makeUser('recipient', ['signature_image_path' => 'signatures/9/lost.png']);
        $this->makeUser('supervisor');

        Sanctum::actingAs($this->makeUser('admin'));
        $res = $this->getJson('/api/admin/storage-check')->assertStatus(200)
            ->assertJsonPath('data.missing.checked', 3)
            ->assertJsonPath('data.missing.total', 3)
            ->assertJsonPath('data.missing.unchecked', 0);

        $this->assertSame(
            [['user_id' => $lost->id, 'name' => $lost->name, 'email' => $lost->email, 'role' => 'recipient', 'file' => 'signature']],
            $res->json('data.missing.files'),
        );
        $this->assertNotContains($kept->id, array_column($res->json('data.missing.files'), 'user_id'));
    }

    public function test_only_admins_can_run_it(): void
    {
        Sanctum::actingAs($this->makeUser('supervisor'));
        $this->getJson('/api/admin/storage-check')->assertStatus(403);
    }
}
