<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Setting;
use App\Models\TermReport;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * PDF/Word uploads: the letter of intent (only that application document takes Word),
 * the promissory note, and the end-of-term report, which is typed OR uploaded.
 */
class WordUploadTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    private function docx(string $name = 'report.docx'): UploadedFile
    {
        return UploadedFile::fake()->create($name, 40, self::DOCX);
    }

    public function test_only_the_letter_of_intent_accepts_word(): void
    {
        Storage::fake('public');
        Setting::put('applications_open', true);
        $applicant = $this->makeUser('applicant');
        $application = Application::create([
            'user_id' => $applicant->id, 'academic_year' => '2024-2025', 'semester' => '1st Semester', 'status' => 'submitted',
        ]);
        Sanctum::actingAs($applicant);
        $url = "/api/applicant/applications/{$application->id}/documents";

        $this->postJson($url, ['document_type' => 'letter_of_intent', 'file' => $this->docx('letter.docx')])->assertStatus(201);
        $this->postJson($url, ['document_type' => 'letter_of_intent', 'file' => UploadedFile::fake()->create('letter.doc', 40, 'application/msword')])->assertStatus(201);

        $this->postJson($url, ['document_type' => 'cor', 'file' => $this->docx('cor.docx')])
            ->assertStatus(422)->assertJsonPath('errors.file.0', 'This document must be a PDF, JPG or PNG file.');
        $this->postJson($url, ['document_type' => 'letter_of_intent', 'file' => UploadedFile::fake()->create('letter.txt', 5, 'text/plain')])
            ->assertStatus(422)->assertJsonPath('errors.file.0', 'Letter of intent must be a PDF, Word, JPG or PNG file.');
    }

    public function test_the_promissory_note_accepts_word(): void
    {
        Storage::fake('public');
        Notification::fake();
        $recipient = $this->makeUser('recipient');
        // A semester that ended yesterday, short on hours (as in PromissoryNoteTest).
        $assignment = $this->makeAssignment($recipient, $this->makeUser('supervisor'), null, [
            'required_hours' => 200,
            'start_date' => Carbon::now('Asia/Manila')->subMonths(5)->toDateString(),
            'end_date' => Carbon::now('Asia/Manila')->subDay()->toDateString(),
        ]);
        $this->makeClosedLog($assignment, 5);
        Sanctum::actingAs($recipient);

        $this->postJson('/api/recipient/promissory', ['assignment_id' => $assignment->id, 'file' => $this->docx('promissory.docx')])
            ->assertStatus(201)->assertJsonPath('data.status', 'pending');
    }

    public function test_the_term_report_can_be_uploaded_instead_of_typed(): void
    {
        Storage::fake('public');
        Notification::fake();
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        $assignment = $this->makeAssignment($recipient, $supervisor);
        Sanctum::actingAs($recipient);

        // Neither text nor file.
        $this->post('/api/recipient/term-report', ['_method' => 'PUT'], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('message', 'Write your report or upload it as a PDF/Word file.');
        // Short text still needs 100 characters when there's no file.
        $this->post('/api/recipient/term-report', ['_method' => 'PUT', 'content' => 'Too short.'], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('errors.content.0', 'Your report must be at least 100 characters.');
        // Only PDF or Word.
        $this->post('/api/recipient/term-report', ['_method' => 'PUT', 'file' => UploadedFile::fake()->image('report.jpg')], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('errors.file.0', 'Upload the report as a PDF or Word file (.pdf, .doc, .docx).');

        // The file alone counts as submitted.
        $this->post('/api/recipient/term-report', ['_method' => 'PUT', 'file' => $this->docx()], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.content', null)
            ->assertJsonPath('data.has_file', true)
            ->assertJsonPath('data.file_name', 'report.docx');
        $report = TermReport::firstWhere('assignment_id', $assignment->id);
        $this->assertNotNull($report->submitted_at);
        Storage::disk('public')->assertExists($first = $report->file_path);

        // Typing text later keeps the file; a new upload replaces (and deletes) the old one.
        $this->post('/api/recipient/term-report', ['_method' => 'PUT', 'content' => str_repeat('Filed and encoded the office records this term. ', 3)], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.has_file', true);
        $this->post('/api/recipient/term-report', ['_method' => 'PUT', 'file' => UploadedFile::fake()->create('final.pdf', 40, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.file_name', 'final.pdf');
        Storage::disk('public')->assertMissing($first);

        // Removing the file with no text left is refused; with text it works.
        $this->post('/api/recipient/term-report', ['_method' => 'PUT', 'remove_file' => '1'], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('message', 'Write your report or upload it as a PDF/Word file.');

        // The owner and their supervisor can download it; another supervisor can't.
        $this->get('/api/recipient/term-report/file')->assertOk()->assertDownload('final.pdf');
        Sanctum::actingAs($supervisor);
        $this->get("/api/supervisor/assignments/{$assignment->id}/term-report/file")->assertOk()->assertDownload('final.pdf');
        $this->getJson("/api/supervisor/students/{$recipient->id}/summary")->assertJsonPath('term_report.file_name', 'final.pdf');
        Sanctum::actingAs($this->makeUser('supervisor'));
        $this->getJson("/api/supervisor/assignments/{$assignment->id}/term-report/file")->assertNotFound();
    }

    public function test_a_typed_report_has_no_file_to_download(): void
    {
        $recipient = $this->makeUser('recipient');
        $this->makeAssignment($recipient, $this->makeUser('supervisor'));
        Sanctum::actingAs($recipient);

        $this->putJson('/api/recipient/term-report', ['content' => str_repeat('Assisted the office with records and queries. ', 3)])
            ->assertOk()->assertJsonPath('data.has_file', false);
        $this->getJson('/api/recipient/term-report/file')->assertNotFound();
    }
}
