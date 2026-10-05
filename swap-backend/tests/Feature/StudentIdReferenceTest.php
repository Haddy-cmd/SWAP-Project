<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\StipendHistory;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** The 9-digit student ID is how a student is referenced: stub control numbers, the stub itself, admin search. */
class StudentIdReferenceTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private const PW = 'Password@123';

    private function withProfile(User $user, string $sid): User
    {
        StudentProfile::create([
            'user_id' => $user->id, 'student_id_number' => $sid, 'first_name' => 'Amir', 'last_name' => 'Alonto',
            'college' => 'CICS', 'program' => 'BSIT', 'year_level' => 3,
        ]);

        return $user->fresh('profile');
    }

    /** A recipient whose 1st Semester 2024-2025 placement already meets its hours. */
    private function eligible(?string $sid): User
    {
        $supervisor = $this->makeUser('supervisor');
        $recipient = $this->makeUser('recipient');
        if ($sid) {
            $recipient = $this->withProfile($recipient, $sid);
        }
        $assignment = $this->makeAssignment($recipient, $supervisor, null, ['required_hours' => 3]);
        $this->makeClosedLog($assignment, 4);
        $this->submitTermReport($assignment);

        return $recipient;
    }

    private function release(User $recipient): StipendHistory
    {
        $this->postJson('/api/admin/stipend/release', [
            'user_id' => $recipient->id, 'academic_year' => '2024-2025', 'semester' => '1st Semester', 'password' => self::PW,
        ])->assertStatus(201);

        return StipendHistory::where('user_id', $recipient->id)->latest('id')->firstOrFail();
    }

    public function test_the_stub_control_number_is_built_from_the_student_id_and_term(): void
    {
        $recipient = $this->eligible('202512345');
        Sanctum::actingAs($this->makeUser('admin', ['position_title' => 'Director']));

        $stub = $this->release($recipient);
        $this->assertSame('SWAP-STP-202512345-2425S1', $stub->control_number);

        // Voided and issued again for the same term: a revision suffix keeps it unique.
        $this->postJson("/api/admin/stipend/{$stub->id}/void", ['reason' => 'Wrong amount.', 'password' => self::PW])->assertOk();
        $this->assertSame('SWAP-STP-202512345-2425S1-R2', $this->release($recipient)->control_number);
    }

    public function test_a_recipient_without_a_student_id_falls_back_to_the_account_number(): void
    {
        $recipient = $this->eligible(null);
        Sanctum::actingAs($this->makeUser('admin', ['position_title' => 'Director']));

        $this->assertSame("SWAP-STP-U{$recipient->id}-2425S1", $this->release($recipient)->control_number);
    }

    public function test_the_stub_shows_the_student_id(): void
    {
        $recipient = $this->eligible('202512345');
        Sanctum::actingAs($this->makeUser('admin', ['position_title' => 'Director']));
        $stub = $this->release($recipient);

        $this->assertSame('SWAP-STP-202512345-2425S1', $stub->fresh()->control_number);

        $html = preg_replace('/\s+/', ' ', view('stipend.slip', [
            'stipend' => $stub->fresh()->load(['recipient.profile', 'signatures.user']),
        ])->render());
        $this->assertStringContainsString('(Student ID <b>202512345</b>)', $html);
    }

    public function test_admins_find_students_by_student_id(): void
    {
        $recipient = $this->eligible('202512345');
        $other = $this->withProfile($this->makeUser('applicant'), '202599999');
        Application::create(['user_id' => $other->id, 'academic_year' => '2024-2025', 'semester' => '1st Semester', 'status' => 'submitted']);
        Sanctum::actingAs($admin = $this->makeUser('admin', ['position_title' => 'Director']));

        $this->getJson('/api/admin/applications?search=202599999')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.user_id', $other->id);
        $this->getJson('/api/admin/users?search=2025123')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $recipient->id);

        $this->getJson('/api/admin/stipend/eligible')->assertOk()
            ->assertJsonFragment(['user_id' => $recipient->id, 'student_id_number' => '202512345']);

        $this->release($recipient);
        $this->getJson('/api/admin/stipend?search=202512345')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/stipend?search=SWAP-STP-202512345')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/stipend?search=999999')->assertOk()->assertJsonCount(0, 'data');
    }
}
