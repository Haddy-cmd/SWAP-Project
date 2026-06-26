<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\ApplicationDocument;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

class DocumentTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    protected function setUp(): void
    {
        parent::setUp();
        // Enable application submissions
        Setting::put('applications_open', true);
    }

    public function test_applicant_can_upload_and_view_document(): void
    {
        Storage::fake('public');

        $applicant = $this->makeUser('applicant');
        $application = Application::create([
            'user_id' => $applicant->id,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'status' => 'submitted',
        ]);

        Sanctum::actingAs($applicant);

        $file = UploadedFile::fake()->image('test_doc.jpg');

        $res = $this->postJson("/api/applicant/applications/{$application->id}/documents", [
            'document_type' => 'birth_certificate',
            'file' => $file,
        ]);

        $res->assertStatus(201);

        // Verify database entry
        $doc = ApplicationDocument::first();
        $this->assertNotNull($doc);
        $this->assertStringStartsWith('documents/', $doc->file_path);
        $this->assertEquals('birth_certificate', $doc->document_type);

        // Assert file exists on fake storage
        Storage::disk('public')->assertExists($doc->file_path);

        // Retrieve document
        $token = $res->json('token') ?? $applicant->tokens()->first()?->token ?? 'dummy';
        // Note: Sanctum tokens in DB are hashed. We need plain text. Since we act as applicant,
        // let's create a fresh token to get the plaintext token.
        $tokenResult = $applicant->createToken('test_token');
        $plainToken = $tokenResult->plainTextToken;

        // Try viewing document with token in authorization header
        $viewRes = $this->withHeaders([
            'Authorization' => "Bearer {$plainToken}",
        ])->getJson("/api/documents/{$doc->id}/file");

        $viewRes->assertStatus(200);

        // Try viewing document with token in query parameters (which simulates browser tab open)
        $viewResQuery = $this->getJson("/api/documents/{$doc->id}/file?token={$plainToken}");
        $viewResQuery->assertStatus(200);
    }

    public function test_corrupted_document_path_returns_404(): void
    {
        $applicant = $this->makeUser('applicant');
        $application = Application::create([
            'user_id' => $applicant->id,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'status' => 'submitted',
        ]);

        $doc = ApplicationDocument::create([
            'application_id' => $application->id,
            'document_type' => 'cor',
            'file_path' => 'api/documents/{DOC_ID}/file',
            'file_url' => 'http://localhost:8000/api/documents/{DOC_ID}/file',
            'file_name' => 'cor.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
        ]);

        $tokenResult = $applicant->createToken('test_token');
        $plainToken = $tokenResult->plainTextToken;

        $res = $this->withHeaders([
            'Authorization' => "Bearer {$plainToken}",
        ])->getJson("/api/documents/{$doc->id}/file");

        $res->assertStatus(404)
            ->assertJsonFragment([
                'message' => 'Document file path is invalid or corrupted. The applicant may need to re-upload this document.',
            ]);
    }
}
