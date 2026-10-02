<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\SemesterPeriod;
use App\Models\Setting;
use App\Services\ApplicationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** A new application is always for the current semester; the applicant doesn't pick it. */
class ApplicationTermTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    protected function setUp(): void
    {
        parent::setUp();
        Setting::put('applications_open', '1');
    }

    private function period(string $year, string $semester, int $startOffsetDays, int $endOffsetDays): SemesterPeriod
    {
        $today = Carbon::now('Asia/Manila')->startOfDay();

        return SemesterPeriod::create([
            'academic_year' => $year, 'semester' => $semester,
            'start_date' => $today->copy()->addDays($startOffsetDays)->toDateString(),
            'end_date' => $today->copy()->addDays($endOffsetDays)->toDateString(),
        ]);
    }

    public function test_the_application_is_for_the_current_semester_whatever_is_sent(): void
    {
        $this->period('2026-2027', '1st Semester', -30, 60);
        $this->period('2026-2027', '2nd Semester', 70, 180);

        $this->getJson('/api/settings/application-status')->assertOk()
            ->assertJsonPath('data.term', ['academic_year' => '2026-2027', 'semester' => '1st Semester']);

        Sanctum::actingAs($this->makeUser('applicant'));
        $id = $this->postJson('/api/applicant/applications', ['academic_year' => '2024-2025', 'semester' => 'Summer'])
            ->assertStatus(201)->json('data.id');

        $application = Application::findOrFail($id);
        $this->assertSame(['2026-2027', '1st Semester'], [$application->academic_year, $application->semester]);
    }

    public function test_between_semesters_it_is_the_next_one(): void
    {
        $this->period('2025-2026', '2nd Semester', -200, -20);
        $this->period('2026-2027', '1st Semester', 10, 120);

        Sanctum::actingAs($this->makeUser('applicant'));
        $id = $this->postJson('/api/applicant/applications')->assertStatus(201)->json('data.id');

        $this->assertSame('2026-2027 1st Semester', Application::findOrFail($id)->academic_year . ' ' . Application::findOrFail($id)->semester);
    }

    public function test_without_a_semester_on_the_calendar_no_application_can_be_filed(): void
    {
        $this->getJson('/api/settings/application-status')->assertOk()->assertJsonPath('data.term', null);

        Sanctum::actingAs($this->makeUser('applicant'));
        $this->postJson('/api/applicant/applications')->assertStatus(422)
            ->assertJsonPath('message', ApplicationService::MSG_NO_TERM);
        $this->assertSame(0, Application::count());
    }
}
