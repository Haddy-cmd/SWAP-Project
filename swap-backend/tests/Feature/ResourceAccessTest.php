<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\ApplicationDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * Authorization for the token-in-URL file streaming endpoints
 * (/api/documents/{id}/file and /api/users/{id}/avatar): only the owner, their
 * supervisor, or an admin may view — any other valid token gets 403.
 */
class ResourceAccessTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    /** @return array{0: User, 1: User, 2: ApplicationDocument} owner, supervisor, document */
    private function makeOwnedDocument(): array
    {
        $owner = $this->makeUser('recipient');
        $supervisor = $this->makeUser('supervisor');
        $this->makeAssignment($owner, $supervisor);

        $application = Application::create([
            'user_id' => $owner->id,
            'academic_year' => '2025-2026',
            'semester' => '1st Semester',
            'status' => 'approved',
        ]);

        Storage::disk('public')->put("documents/{$application->id}/cor.jpg", 'img-bytes');

        $doc = ApplicationDocument::create([
            'application_id' => $application->id,
            'document_type' => 'cor',
            'file_path' => "documents/{$application->id}/cor.jpg",
            'file_url' => 'unused',
            'file_name' => 'cor.jpg',
            'file_size' => 9,
            'mime_type' => 'image/jpeg',
        ]);

        return [$owner, $supervisor, $doc];
    }

    private function makeUserWithAvatar(): array
    {
        $subject = $this->makeUser('recipient');
        $supervisor = $this->makeUser('supervisor');
        $this->makeAssignment($subject, $supervisor);

        Storage::disk('public')->put("avatars/{$subject->id}/photo.jpg", 'img-bytes');
        $subject->update(['avatar_path' => "avatars/{$subject->id}/photo.jpg"]);

        return [$subject, $supervisor];
    }

    private function tokenFor(User $user): string
    {
        return $user->createToken('test')->plainTextToken;
    }

    // ── documents ────────────────────────────────────────────────────────────

    public function test_document_owner_can_view(): void
    {
        [$owner, , $doc] = $this->makeOwnedDocument();

        $this->get("/api/documents/{$doc->id}/file?token=" . urlencode($this->tokenFor($owner)))
            ->assertOk();
    }

    public function test_assigned_supervisor_can_view_document(): void
    {
        [, $supervisor, $doc] = $this->makeOwnedDocument();

        $this->get("/api/documents/{$doc->id}/file?token=" . urlencode($this->tokenFor($supervisor)))
            ->assertOk();
    }

    public function test_admin_can_view_document(): void
    {
        [, , $doc] = $this->makeOwnedDocument();
        $admin = $this->makeUser('admin');

        $this->get("/api/documents/{$doc->id}/file?token=" . urlencode($this->tokenFor($admin)))
            ->assertOk();
    }

    public function test_unrelated_user_cannot_view_document(): void
    {
        [, , $doc] = $this->makeOwnedDocument();
        $stranger = $this->makeUser('recipient');

        $this->get("/api/documents/{$doc->id}/file?token=" . urlencode($this->tokenFor($stranger)))
            ->assertStatus(403);
    }

    public function test_unrelated_supervisor_cannot_view_document(): void
    {
        [, , $doc] = $this->makeOwnedDocument();
        $otherSupervisor = $this->makeUser('supervisor', ['office_id' => $this->makeOffice()->id]);

        $this->get("/api/documents/{$doc->id}/file?token=" . urlencode($this->tokenFor($otherSupervisor)))
            ->assertStatus(403);
    }

    public function test_unauthenticated_document_request_is_rejected(): void
    {
        [, , $doc] = $this->makeOwnedDocument();

        $this->get("/api/documents/{$doc->id}/file")->assertStatus(401);
    }

    // ── avatars ──────────────────────────────────────────────────────────────

    public function test_avatar_owner_can_view(): void
    {
        [$subject] = $this->makeUserWithAvatar();

        $this->get("/api/users/{$subject->id}/avatar?token=" . urlencode($this->tokenFor($subject)))
            ->assertOk();
    }

    public function test_assigned_supervisor_can_view_avatar(): void
    {
        [$subject, $supervisor] = $this->makeUserWithAvatar();

        $this->get("/api/users/{$subject->id}/avatar?token=" . urlencode($this->tokenFor($supervisor)))
            ->assertOk();
    }

    public function test_admin_can_view_avatar(): void
    {
        [$subject] = $this->makeUserWithAvatar();
        $admin = $this->makeUser('admin');

        $this->get("/api/users/{$subject->id}/avatar?token=" . urlencode($this->tokenFor($admin)))
            ->assertOk();
    }

    public function test_unrelated_user_cannot_view_avatar(): void
    {
        [$subject] = $this->makeUserWithAvatar();
        $stranger = $this->makeUser('recipient');

        $this->get("/api/users/{$subject->id}/avatar?token=" . urlencode($this->tokenFor($stranger)))
            ->assertStatus(403);
    }

    public function test_unauthenticated_avatar_request_is_rejected(): void
    {
        [$subject] = $this->makeUserWithAvatar();

        $this->get("/api/users/{$subject->id}/avatar")->assertStatus(401);
    }
}
