<?php

namespace Tests\Feature;

use App\Models\Application;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin → Applications → Interview set → Calendar: one month of interviews in one call. */
class InterviewCalendarFilterTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function interviewAt(string $manila, string $name): Application
    {
        $application = Application::create([
            'user_id' => $this->makeUser('applicant', ['name' => $name])->id,
            'academic_year' => '2026-2027', 'semester' => '1st Semester', 'status' => 'interview_scheduled',
        ]);
        $application->interview()->create([
            'scheduled_at' => Carbon::parse($manila, 'Asia/Manila')->utc(), 'mode' => 'in_person', 'location' => 'Division of Student Affairs (DSA)',
        ]);

        return $application;
    }

    public function test_a_month_of_interviews_by_manila_day_in_time_order(): void
    {
        $this->interviewAt('2026-10-31 07:30', 'Late October');   // Oct 30 23:30 UTC: still October in Manila
        $this->interviewAt('2026-10-05 14:00', 'Afternoon');
        $this->interviewAt('2026-10-05 08:00', 'Morning');
        $this->interviewAt('2026-11-01 07:30', 'November');        // Oct 31 23:30 UTC, but November in Manila
        Sanctum::actingAs($this->makeUser('admin'));

        $res = $this->getJson('/api/admin/applications?status=interview_scheduled&interview_from=2026-10-01&interview_to=2026-10-31&per_page=200')
            ->assertOk()->assertJsonPath('meta.per_page', 200);
        $this->assertSame(['Morning', 'Afternoon', 'Late October'], array_column(array_column($res->json('data'), 'user'), 'name'));

        $this->getJson('/api/admin/applications?per_page=500')->assertStatus(422)->assertJsonValidationErrors('per_page');
        $this->getJson('/api/admin/applications?interview_from=2026-10-31&interview_to=2026-10-01')->assertStatus(422);
        $this->getJson('/api/admin/applications')->assertOk()->assertJsonPath('meta.per_page', 15);
    }
}
