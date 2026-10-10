<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Concern;
use App\Models\User;
use App\Services\RenewalReadinessService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Admin dashboard banner: the "Today:" task list (AnalyticsService::tasks). */
class AnalyticsOverviewTasksTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private const TERM = ['academic_year' => '2024-2025', 'semester' => '1st Semester'];

    private function application(User $user, string $status, string $type = 'new', array $term = self::TERM): Application
    {
        return Application::create($term + ['user_id' => $user->id, 'status' => $status, 'type' => $type]);
    }

    private function withCor(Application $application): Application
    {
        $application->documents()->create(['document_type' => 'cor', 'file_path' => 'x.pdf', 'file_url' => 'x', 'file_name' => 'cor.pdf']);

        return $application;
    }

    private function tasks(): array
    {
        Sanctum::actingAs($this->makeUser('admin'));

        return collect($this->getJson('/api/admin/analytics/overview?' . http_build_query(self::TERM))->assertOk()->json('data.tasks'))
            ->keyBy('key')->all();
    }

    public function test_nothing_waiting_means_an_empty_list(): void
    {
        $this->assertSame([], $this->tasks());
    }

    public function test_each_kind_of_work_is_counted_and_linked(): void
    {
        // Applications waiting (this term only; decided and other-term ones don't count).
        $this->application($this->makeUser('applicant'), 'submitted');
        $this->application($this->makeUser('applicant'), 'interview_scheduled');
        $this->application($this->makeUser('applicant'), 'rejected');
        $this->application($this->makeUser('applicant'), 'submitted', 'new', ['academic_year' => '2023-2024', 'semester' => '1st Semester']);

        // Renewals: one ready, one blocked by the readiness check, one without its COR.
        $ready = $this->withCor($this->application($this->makeUser('recipient'), 'submitted', 'renewal'));
        $blocked = $this->withCor($this->application($this->makeUser('recipient'), 'submitted', 'renewal'));
        $this->application($this->makeUser('recipient'), 'submitted', 'renewal');
        $this->mock(RenewalReadinessService::class, fn ($m) => $m->shouldReceive('check')
            ->andReturnUsing(fn (Application $a) => ['ready' => $a->id === $ready->id]));

        // Interviews: today (Manila) counts; tomorrow and a no-show don't.
        $iv = $this->application($this->makeUser('applicant'), 'rejected');
        $iv->interview()->create(['scheduled_at' => now('Asia/Manila')->setTime(15, 0)->utc(), 'mode' => 'in_person', 'location' => 'DSA', 'status' => 'scheduled']);
        $later = $this->application($this->makeUser('applicant'), 'rejected');
        $later->interview()->create(['scheduled_at' => now('Asia/Manila')->addDay()->setTime(9, 0)->utc(), 'mode' => 'in_person', 'location' => 'DSA', 'status' => 'scheduled']);

        // Approved students: one without an office, one already placed.
        $this->application($this->makeUser('recipient'), 'approved');
        $placed = $this->makeUser('recipient');
        $this->application($placed, 'approved');
        $this->makeAssignment($placed, $this->makeUser('supervisor'), null, self::TERM);

        // Concerns: only open ones wait for a reply.
        foreach (['open', 'in_progress', 'resolved'] as $status) {
            Concern::create(['user_id' => $this->makeUser('recipient')->id, 'subject' => 'Help', 'message' => 'Question', 'status' => $status]);
        }

        $tasks = $this->tasks();

        $this->assertSame(['applications', 'renewals', 'interviews', 'placements', 'concerns'], array_keys($tasks));
        $this->assertSame(['key' => 'applications', 'count' => 2, 'label' => '2 applications to review', 'href' => '/admin/applications'], $tasks['applications']);
        $this->assertSame(['count' => 1, 'label' => '1 renewal ready to approve', 'href' => '/admin/applications?type=renewal'],
            array_intersect_key($tasks['renewals'], array_flip(['count', 'label', 'href'])));
        $this->assertSame('1 interview today', $tasks['interviews']['label']);
        $this->assertSame('1 approved, need an office', $tasks['placements']['label']);
        $this->assertSame('/admin/concerns', $tasks['concerns']['href']);
        $this->assertSame('1 concern waiting for a reply', $tasks['concerns']['label']);
        // Stipends: nobody is payable here, so it's left out.
        $this->assertArrayNotHasKey('stipends', $tasks);
    }
}
