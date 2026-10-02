<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Office logos are streamed through the API, so they show even from a private storage bucket. */
class OfficeLogoTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_an_uploaded_logo_is_served_through_the_api_without_a_login(): void
    {
        Storage::fake(config('filesystems.documents_disk', 'public'));
        $office = $this->makeOffice();
        Sanctum::actingAs($this->makeUser('admin'));

        $url = $this->post("/api/admin/offices/{$office->id}/logo", [
            'logo' => UploadedFile::fake()->image('logo.png', 120, 120),
        ], ['Accept' => 'application/json'])->assertOk()->json('data.logo_url');

        $this->assertStringContainsString("/api/offices/{$office->id}/logo?v=", $url);

        // Public: an <img> on any page (or a logged-out visitor) can load it.
        $this->app['auth']->forgetGuards();
        $res = $this->get("/api/offices/{$office->id}/logo");
        $res->assertOk();
        $this->assertSame('image/png', $res->headers->get('Content-Type'));
        $this->assertStringContainsString('public', $res->headers->get('Cache-Control'));

        // A new logo gets a new URL, so browsers never keep the old one.
        Sanctum::actingAs($this->makeUser('admin'));
        $replaced = $this->post("/api/admin/offices/{$office->id}/logo", [
            'logo' => UploadedFile::fake()->image('logo2.png', 120, 120),
        ], ['Accept' => 'application/json'])->assertOk()->json('data.logo_url');
        $this->assertNotSame($url, $replaced);
    }

    public function test_an_office_without_a_logo_or_a_missing_file_returns_404(): void
    {
        Storage::fake(config('filesystems.documents_disk', 'public'));
        $office = $this->makeOffice();

        $this->getJson("/api/offices/{$office->id}/logo")->assertStatus(404)->assertJsonPath('message', 'No logo.');
        $this->assertNull($office->fresh()->logo_url);

        // The database still points at a file the storage no longer has.
        $office->update(['logo_path' => 'office-logos/gone.png']);
        $this->getJson("/api/offices/{$office->id}/logo")->assertStatus(404)
            ->assertJsonPath('message', 'Logo not found on storage.');
    }
}
