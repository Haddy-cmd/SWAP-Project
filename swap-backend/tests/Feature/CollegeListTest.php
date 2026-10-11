<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\StudentProfile;
use App\Support\Colleges;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Colleges and programs come from the official list (config/colleges.php). */
class CollegeListTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function register(array $overrides): \Illuminate\Testing\TestResponse
    {
        Notification::fake();
        Setting::put('applications_open', '1');

        return $this->postJson('/api/auth/register', array_merge([
            'email' => 'amina' . uniqid() . '@s.msumain.edu.ph',
            'password' => 'Password@123', 'password_confirmation' => 'Password@123',
            'student_id_number' => (string) random_int(100000000, 999999999),
            'first_name' => 'Amina', 'last_name' => 'Macarambon', 'year_level' => 2,
        ], $overrides));
    }

    private function profile(string $college, string $program): StudentProfile
    {
        return StudentProfile::create([
            'user_id' => $this->makeUser('applicant')->id, 'student_id_number' => (string) random_int(100000000, 999999999),
            'first_name' => 'A', 'last_name' => 'B', 'college' => $college, 'program' => $program, 'year_level' => 2,
        ]);
    }

    public function test_the_list_has_coa_and_cfas(): void
    {
        $this->assertSame('College of Agriculture', Colleges::label('COA'));
        $this->assertSame('College of Fisheries and Aquatic Sciences', Colleges::label('CFAS'));
        $this->assertNull(Colleges::label('CA'));
        $this->assertCount(15, Colleges::codes());
    }

    public function test_registration_takes_only_listed_colleges_and_their_programs(): void
    {
        // Accepted: held until the emailed code confirms it (AuthTest covers that step).
        $this->register(['college' => 'COA', 'program' => 'BSA Horticulture'])->assertStatus(202);
        $this->assertDatabaseCount('pending_registrations', 1);

        $this->register(['college' => 'CSST', 'program' => 'BSCS'])->assertStatus(422)
            ->assertJsonPath('errors.college.0', Colleges::MSG_COLLEGE);
        $this->register(['college' => 'CFAS', 'program' => 'BS Computer Science'])->assertStatus(422)
            ->assertJsonPath('errors.program.0', Colleges::MSG_PROGRAM);
    }

    public function test_profile_updates_keep_college_and_program_together(): void
    {
        $profile = $this->profile('CICS', 'BS Computer Science');
        Sanctum::actingAs($profile->user);

        $this->putJson('/api/profile', ['program' => 'BS Fisheries'])->assertStatus(422)
            ->assertJsonPath('errors.program.0', Colleges::MSG_PROGRAM);
        $this->putJson('/api/profile', ['college' => 'CFAS'])->assertStatus(422)
            ->assertJsonPath('errors.program.0', Colleges::MSG_PROGRAM);
        $this->putJson('/api/profile', ['college' => 'CFAS', 'program' => 'BS Fisheries'])->assertOk();
        $this->assertSame(['CFAS', 'BS Fisheries'], [$profile->fresh()->college, $profile->fresh()->program]);
    }

    public function test_old_values_are_mapped_to_the_official_list(): void
    {
        $old = [
            ['CA', 'BS Agriculture', 'COA', 'BS Agriculture major in Agronomy'],
            ['CF', 'BS Fisheries', 'CFAS', 'BS Fisheries'],
            ['CSST', 'BSCS', 'CICS', 'BS Computer Science'],
            ['CAS', 'BSMATH', 'CNSM', 'BS Mathematics'],
            ['College of Information and Computing Sciences', 'BS Computer Science', 'CICS', 'BS Computer Science'],
            ['CoE', 'BS Computer Engineering', 'CoE', 'BS Electronics Engineering'],
            ['CICS', 'BS Information Systems', 'CICS', 'BS Information Systems'], // already official: untouched
        ];
        $rows = array_map(fn ($r) => [$this->profile($r[0], $r[1]), $r[2], $r[3]], $old);
        $secondary = $this->profile('CED', 'Bachelor of Secondary Education');

        Colleges::normalize();

        foreach ($rows as [$profile, $college, $program]) {
            $this->assertSame([$college, $program], [$profile->fresh()->college, $profile->fresh()->program]);
        }
        $this->assertContains($secondary->fresh()->program, ['BSEd English', 'BSEd Filipino', 'BSEd Mathematics', 'BSEd Sciences', 'BSEd Social Studies']);
        $this->assertSame(0, Colleges::normalize(), 'running it again changes nothing');
    }
}
