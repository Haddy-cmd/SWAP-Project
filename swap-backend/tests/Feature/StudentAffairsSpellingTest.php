<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Interview;
use App\Services\ApplicationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** "Division / Office of the Dean of Student Affairs" — never "Students Affairs". */
class StudentAffairsSpellingTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_the_default_interview_venue_is_spelled_correctly(): void
    {
        $this->assertSame('Office of the Dean of Student Affairs (DSA)', ApplicationService::DSA_OFFICE_LOCATION);
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
