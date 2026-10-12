<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\FaqKnowledgeBase;
use App\Models\Interview;
use App\Services\ApplicationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** The DSA is the "Division of Student Affairs" — not "Students Affairs", not an "Office of the Dean". */
class StudentAffairsSpellingTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_the_default_interview_venue_is_spelled_correctly(): void
    {
        $this->assertSame('Division of Student Affairs (DSA)', ApplicationService::DSA_OFFICE_LOCATION);
    }

    public function test_the_rename_migration_corrects_stored_copies_and_audits_them(): void
    {
        // The office migrations add a "Division of Student Affairs"; without it the old office takes the name.
        DB::table('offices')->where('name', 'Division of Student Affairs')->delete();
        $application = Application::create([
            'user_id' => $this->makeUser('applicant')->id,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'status' => 'interview_scheduled',
        ]);
        $interview = $application->interview()->create([
            'scheduled_at' => now()->addDay(),
            'mode' => 'in_person',
            'location' => 'Office of the Dean of Student Affairs (DSA)',
        ]);
        $office = $this->makeOffice(['name' => 'Office of the Dean of Student Affairs', 'location' => 'Beside the Dean of Student Affairs']);
        $admin = $this->makeUser('admin', ['position_title' => 'Director, Office of the Dean of Student Affairs']);
        $faq = FaqKnowledgeBase::create([
            'category' => 'interview', 'question' => 'Where are interviews held?',
            'answer' => 'Usually at the Office of the Dean of Student Affairs (DSA).', 'keywords' => ['interview'], 'sort_order' => 1,
        ]);
        $untouched = $this->makeOffice(['name' => 'ICT Center']);

        $this->runRename();

        $this->assertSame('Division of Student Affairs (DSA)', $interview->fresh()->location);
        $this->assertSame('Division of Student Affairs', $office->fresh()->name);
        $this->assertSame('Beside the Division of Student Affairs', $office->fresh()->location);
        $this->assertSame('Director, Division of Student Affairs', $admin->fresh()->position_title);
        $this->assertSame('Usually at the Division of Student Affairs (DSA).', $faq->fresh()->answer);
        $this->assertSame('ICT Center', $untouched->fresh()->name);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'spelling_corrected', 'auditable_type' => FaqKnowledgeBase::class, 'auditable_id' => $faq->id,
        ]);
        $this->assertDatabaseCount('audit_logs', 4);

        $this->runRename(); // Running again changes nothing.
        $this->assertDatabaseCount('audit_logs', 4);
    }

    public function test_an_office_is_not_renamed_onto_an_existing_name(): void
    {
        if (!DB::table('offices')->where('name', 'Division of Student Affairs')->exists()) {
            $this->makeOffice(['name' => 'Division of Student Affairs']);
        }
        $old = $this->makeOffice(['name' => 'Office of the Dean of Student Affairs', 'description' => 'Old Dean of Student Affairs office.']);

        $this->runRename();

        $this->assertSame('Office of the Dean of Student Affairs', $old->fresh()->name);
        $this->assertSame('Old Division of Student Affairs office.', $old->fresh()->description);
    }

    private function runRename(): void
    {
        (require database_path('migrations/2026_10_13_000001_rename_dsa_to_division.php'))->up();
    }

    public function test_the_migration_corrects_stored_copies_and_audits_them(): void
    {
        $application = Application::create([
            'user_id' => $this->makeUser('applicant')->id,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'status' => 'interview_scheduled',
        ]);
        $interview = $application->interview()->create([
            'scheduled_at' => now()->addDay(),
            'mode' => 'in_person',
            'location' => 'Office of the Dean of Students Affairs (DSA)',
        ]);
        $office = $this->makeOffice(['name' => 'Office of the Dean of Students Affairs']);
        $admin = $this->makeUser('admin', ['position_title' => 'Director, Division of Students Affairs']);
        $untouched = $this->makeOffice(['name' => 'ICT Center']);

        (require database_path('migrations/2026_09_25_000004_fix_student_affairs_spelling.php'))->up();

        $this->assertSame('Office of the Dean of Student Affairs (DSA)', $interview->fresh()->location);
        $this->assertSame('Office of the Dean of Student Affairs', $office->fresh()->name);
        $this->assertSame('Director, Division of Student Affairs', $admin->fresh()->position_title);
        $this->assertSame('ICT Center', $untouched->fresh()->name);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'spelling_corrected', 'auditable_type' => Interview::class, 'auditable_id' => $interview->id,
        ]);
        $this->assertDatabaseCount('audit_logs', 3);
    }
}
