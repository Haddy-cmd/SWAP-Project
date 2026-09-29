<?php

namespace Tests\Feature;

use App\Models\LandingPhoto;
use App\Services\LandingPhotoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin → Landing Page: the carousel photos admins manage, and the public feed. */
class LandingPhotoTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function actingAsAdmin()
    {
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);

        return $admin;
    }

    public function test_the_carousel_starts_with_the_18_built_in_photos(): void
    {
        $res = $this->getJson('/api/landing/photos')->assertOk();

        $this->assertCount(18, $res->json('data'));
        $res->assertJsonPath('data.0.url', '/campus.jpg')
            ->assertJsonPath('data.0.caption', 'DSA Mental Health Celebration, 2025')
            ->assertJsonPath('data.1.url', '/campus-9.jpg');
    }

    public function test_admin_uploads_a_photo_that_is_resized_and_served(): void
    {
        $admin = $this->actingAsAdmin();

        $res = $this->post('/api/admin/landing/photos', [
            'photo' => UploadedFile::fake()->image('event.jpg', 3000, 2000),
            'caption' => 'SWAP orientation, 2026',
        ], ['Accept' => 'application/json'])->assertCreated()
            ->assertJsonPath('data.source', 'uploaded')
            ->assertJsonPath('data.width', LandingPhotoService::MAX_WIDTH);

        $photo = LandingPhoto::findOrFail($res->json('data.id'));
        $this->assertSame(1066, $photo->height); // 3000×2000 scaled to 1600 wide (GD rounds down)
        $this->assertSame(19, $photo->sort_order); // appended after the built-ins
        $this->assertDatabaseHas('audit_logs', ['action' => 'created', 'auditable_type' => LandingPhoto::class, 'auditable_id' => $photo->id, 'user_id' => $admin->id]);

        // It shows up in the public carousel (cache cleared) with a versioned URL…
        $last = collect($this->getJson('/api/landing/photos')->json('data'))->last();
        $this->assertSame('SWAP orientation, 2026', $last['caption']);
        $this->assertStringContainsString("/api/landing/photos/{$photo->id}/image?v=", $last['url']);

        // …and the bytes are a real, cache-forever JPEG.
        $image = $this->get("/api/landing/photos/{$photo->id}/image")->assertOk()
            ->assertHeader('Content-Type', 'image/jpeg');
        $this->assertStringContainsString('immutable', $image->headers->get('Cache-Control'));
        $this->assertSame([1600, 1066], array_slice(getimagesizefromstring($image->getContent()), 0, 2));
    }

    public function test_upload_rejects_non_images_and_oversized_files(): void
    {
        $this->actingAsAdmin();

        $this->post('/api/admin/landing/photos', [
            'photo' => UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf'),
            'caption' => 'A PDF',
        ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('photo');

        $this->post('/api/admin/landing/photos', [
            'photo' => UploadedFile::fake()->image('huge.jpg', 800, 600)->size(9000),
            'caption' => 'Too big',
        ], ['Accept' => 'application/json'])->assertStatus(422)
            ->assertJsonPath('errors.photo.0', 'The photo must be 8 MB or smaller.');

        $this->post('/api/admin/landing/photos', [
            'photo' => UploadedFile::fake()->image('ok.jpg', 800, 600),
        ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('caption');
    }

    public function test_the_carousel_is_capped_at_30_photos(): void
    {
        $this->actingAsAdmin();
        foreach (range(19, LandingPhotoService::MAX_PHOTOS) as $n) {
            LandingPhoto::create(['caption' => "Extra {$n}", 'sort_order' => $n, 'bundled_path' => "/campus.jpg"]);
        }

        $this->post('/api/admin/landing/photos', [
            'photo' => UploadedFile::fake()->image('one-more.jpg', 800, 600),
            'caption' => 'One too many',
        ], ['Accept' => 'application/json'])->assertStatus(422)
            ->assertJsonPath('message', LandingPhotoService::MSG_LIMIT);
    }

    public function test_admin_edits_hides_reorders_and_deletes(): void
    {
        $this->actingAsAdmin();
        $first = LandingPhoto::orderBy('sort_order')->first();
        $second = LandingPhoto::orderBy('sort_order')->skip(1)->first();

        // Caption edit.
        $this->putJson("/api/admin/landing/photos/{$first->id}", ['caption' => 'New caption'])
            ->assertOk()->assertJsonPath('data.caption', 'New caption');

        // Hide: gone from the public carousel, still in the admin list.
        $this->putJson("/api/admin/landing/photos/{$second->id}", ['is_active' => false])->assertOk();
        $public = collect($this->getJson('/api/landing/photos')->json('data'));
        $this->assertCount(17, $public);
        $this->assertFalse($public->contains('id', $second->id));
        $this->getJson('/api/admin/landing/photos')->assertOk()->assertJsonCount(18, 'data');

        // Reorder: move the last photo to the front.
        $ids = LandingPhoto::orderBy('sort_order')->pluck('id')->all();
        $newOrder = array_merge([end($ids)], array_slice($ids, 0, -1));
        $this->putJson('/api/admin/landing/photos/order', ['ids' => $newOrder])->assertOk();
        $this->assertSame(end($ids), $this->getJson('/api/landing/photos')->json('data.0.id'));

        // A partial order is refused.
        $this->putJson('/api/admin/landing/photos/order', ['ids' => [$first->id]])
            ->assertStatus(422)->assertJsonPath('message', LandingPhotoService::MSG_ORDER);

        // Delete.
        $this->deleteJson("/api/admin/landing/photos/{$first->id}")->assertOk();
        $this->assertDatabaseMissing('landing_photos', ['id' => $first->id]);

        foreach (['updated', 'reordered', 'deleted'] as $action) {
            $this->assertDatabaseHas('audit_logs', ['action' => $action, 'auditable_type' => LandingPhoto::class]);
        }
    }

    public function test_only_admins_manage_the_carousel(): void
    {
        $this->getJson('/api/admin/landing/photos')->assertStatus(401);

        foreach (['supervisor', 'recipient', 'applicant'] as $role) {
            Sanctum::actingAs($this->makeUser($role));
            $this->getJson('/api/admin/landing/photos')->assertStatus(403);
            $this->deleteJson('/api/admin/landing/photos/1')->assertStatus(403);
        }

        $this->assertSame(18, LandingPhoto::count());
    }
}
