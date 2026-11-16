<?php

namespace Tests\Feature;

use App\Http\Controllers\Applicant\DocumentController;
use App\Models\Application;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** The 2x2 photo uploaded with the application becomes the applicant's profile photo. */
class ApplicantPhotoTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_the_2x2_photo_becomes_the_profile_photo_and_replaces_an_older_one(): void
    {
        Storage::fake('public');
        $applicant = $this->makeUser('applicant');
        Storage::disk('public')->put("avatars/{$applicant->id}/old.jpg", 'old');
        $applicant->update(['avatar_path' => "avatars/{$applicant->id}/old.jpg"]);
        $application = Application::create(['user_id' => $applicant->id, 'academic_year' => '2026-2027', 'semester' => '1st Semester', 'status' => 'submitted', 'type' => 'new']);
        Sanctum::actingAs($applicant);

        $this->post("/api/applicant/applications/{$application->id}/documents", [
            'document_type' => 'id_photo', 'file' => UploadedFile::fake()->image('me.jpg', 600, 600),
        ], ['Accept' => 'application/json'])->assertCreated();

        $path = $applicant->fresh()->avatar_path;
        $this->assertStringStartsWith("avatars/{$applicant->id}/", $path);
        $this->assertNotSame("avatars/{$applicant->id}/old.jpg", $path);
        Storage::disk('public')->assertExists($path);
        Storage::disk('public')->assertMissing("avatars/{$applicant->id}/old.jpg");
        $this->assertDatabaseHas('audit_logs', ['action' => 'photo_updated', 'auditable_id' => $applicant->id]);

        // They can still remove it on their Profile.
        $this->deleteJson('/api/profile/photo')->assertOk();
        $this->assertNull($applicant->fresh()->avatar_path);
    }

    public function test_the_2x2_photo_must_be_an_image(): void
    {
        Storage::fake('public');
        $applicant = $this->makeUser('applicant');
        $application = Application::create(['user_id' => $applicant->id, 'academic_year' => '2026-2027', 'semester' => '1st Semester', 'status' => 'submitted', 'type' => 'new']);
        Sanctum::actingAs($applicant);

        $this->post("/api/applicant/applications/{$application->id}/documents", [
            'document_type' => 'id_photo', 'file' => UploadedFile::fake()->create('me.pdf', 50, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(422)
            ->assertJsonValidationErrors(['file' => DocumentController::MSG_PHOTO_TYPE]);
        $this->assertNull($applicant->fresh()->avatar_path);
    }
}
