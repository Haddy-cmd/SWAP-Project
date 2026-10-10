<?php

namespace Tests\Feature;

use App\Mail\AnnouncementMail;
use App\Models\Announcement;
use App\Models\AnnouncementAttachment;
use App\Services\AnnouncementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin → Announcements: photos and documents sent with an announcement. */
class AnnouncementAttachmentTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private string $disk;

    protected function setUp(): void
    {
        parent::setUp();
        $this->disk = config('filesystems.documents_disk', 'public');
        Storage::fake($this->disk);
        Mail::fake();
    }

    private function send(array $files)
    {
        return $this->post('/api/admin/announcements', [
            'title' => 'Stipend release schedule',
            'message' => 'Stipends will be released on Friday at the Banking Office.',
            'attachments' => $files,
        ], ['Accept' => 'application/json']);
    }

    public function test_files_are_stored_shown_in_the_portal_copy_and_listed_in_the_email(): void
    {
        $recipient = $this->makeUser('recipient');
        Sanctum::actingAs($this->makeUser('admin'));

        $res = $this->send([
            UploadedFile::fake()->image('venue.jpg', 400, 300),
            UploadedFile::fake()->create('schedule.pdf', 200, 'application/pdf'),
        ])->assertStatus(201)
            ->assertJsonCount(2, 'data.attachments')
            ->assertJsonPath('data.attachments.0.name', 'venue.jpg')
            ->assertJsonPath('data.attachments.0.is_image', true)
            ->assertJsonPath('data.attachments.1.is_image', false);

        $announcement = Announcement::findOrFail($res->json('data.id'));
        foreach ($announcement->attachments as $a) {
            Storage::disk($this->disk)->assertExists($a->file_path);
            $this->assertStringStartsWith("announcements/{$announcement->id}/", $a->file_path);
        }

        $copy = $recipient->notifications()->first();
        $this->assertSame(['venue.jpg', 'schedule.pdf'], array_column($copy->data['attachments'], 'name'));
        $this->assertSame($announcement->id, array_key_last($copy->data) === 'announcement_id' ? $copy->data['announcement_id'] : null);

        Mail::assertSent(AnnouncementMail::class, function (AnnouncementMail $mail) {
            $html = $mail->render();

            return str_contains($html, 'venue.jpg') && str_contains($html, 'schedule.pdf') && str_contains($html, 'Open the SWAP Portal to view or download them.');
        });
    }

    public function test_limits_on_number_size_and_type(): void
    {
        $this->makeUser('recipient');
        Sanctum::actingAs($this->makeUser('admin'));

        $six = array_map(fn ($i) => UploadedFile::fake()->create("f{$i}.pdf", 10, 'application/pdf'), range(1, 6));
        $this->send($six)->assertStatus(422)->assertJsonPath('errors.attachments.0', AnnouncementService::MSG_TOO_MANY_FILES);

        // The error key itself contains a dot ("attachments.0").
        $big = $this->send([UploadedFile::fake()->create('huge.pdf', 11 * 1024, 'application/pdf')])->assertStatus(422);
        $this->assertSame(['huge.pdf is over 10 MB.'], $big->json('errors')['attachments.0']);

        $exe = $this->send([UploadedFile::fake()->create('run.exe', 10, 'application/x-msdownload')])->assertStatus(422);
        $this->assertSame([AnnouncementService::MSG_FILE_TYPE], $exe->json('errors')['attachments.0']);

        $this->assertSame(0, Announcement::count());
    }

    public function test_only_admins_and_those_who_received_it_can_open_a_file(): void
    {
        $recipient = $this->makeUser('recipient');
        $admin = $this->makeUser('admin');
        Sanctum::actingAs($admin);
        $id = $this->send([UploadedFile::fake()->create('schedule.pdf', 50, 'application/pdf')])->json('data.id');
        $file = AnnouncementAttachment::where('announcement_id', $id)->firstOrFail();
        $url = '/api' . $file->url();

        // Joined after it was sent: no portal copy, no file.
        $later = $this->makeUser('recipient');

        $this->app['auth']->forgetGuards();
        $this->get($url)->assertStatus(401);
        $this->get($url . '?token=' . $recipient->createToken('t')->plainTextToken)->assertOk()
            ->assertHeader('Content-Disposition', 'inline; filename="schedule.pdf"');
        $this->get($url . '?token=' . $later->createToken('t')->plainTextToken)->assertStatus(403);
        $this->get($url . '?token=' . $admin->createToken('t')->plainTextToken)->assertOk();
    }

    public function test_deleting_removes_the_files_and_search_filters_the_history(): void
    {
        $this->makeUser('recipient');
        Sanctum::actingAs($this->makeUser('admin'));
        $id = $this->send([UploadedFile::fake()->image('venue.jpg')])->json('data.id');
        $path = AnnouncementAttachment::where('announcement_id', $id)->value('file_path');
        $this->postJson('/api/admin/announcements', ['title' => 'General assembly', 'message' => 'All recipients meet on Monday at the gym.'])->assertStatus(201);

        $this->getJson('/api/admin/announcements?search=assembly')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'General assembly');
        $this->getJson('/api/admin/announcements?search=banking')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.attachments.0.name', 'venue.jpg');

        $this->deleteJson("/api/admin/announcements/{$id}")->assertOk();
        Storage::disk($this->disk)->assertMissing($path);
        $this->assertSame(0, AnnouncementAttachment::count());
    }
}
