<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\StaffInvitation;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Supervisors and admins are identified by their employee ID (digits, unique). */
class EmployeeIdTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private function invite(string $email, string $role = 'supervisor'): string
    {
        $plain = str_repeat('a', 63) . substr(md5($email), 0, 1);
        StaffInvitation::create([
            'email' => $email, 'role' => $role, 'token' => hash('sha256', $plain),
            'invited_by' => $this->makeUser('admin')->id, 'expires_at' => now()->addDays(3),
        ]);

        return $plain;
    }

    private function accept(string $token, array $overrides = [])
    {
        return $this->postJson("/api/invitations/{$token}/accept", array_merge([
            'name' => 'Maria Santos', 'employee_id' => '20190123',
            'password' => 'Secret123', 'password_confirmation' => 'Secret123',
        ], $overrides));
    }

    public function test_staff_enter_a_digits_only_unique_employee_id_when_accepting(): void
    {
        $token = $this->invite('maria@msumain.edu.ph');

        $this->accept($token, ['employee_id' => ''])->assertStatus(422)
            ->assertJsonPath('errors.employee_id.0', 'Enter your employee ID (digits only).');
        $this->accept($token, ['employee_id' => 'EMP-0123'])->assertStatus(422)
            ->assertJsonPath('errors.employee_id.0', 'Enter your employee ID (digits only).');

        $this->makeUser('supervisor', ['employee_id' => '55550000']);
        $this->accept($token, ['employee_id' => '55550000'])->assertStatus(422)
            ->assertJsonPath('errors.employee_id.0', 'This employee ID is already used by another account.');

        $this->accept($token)->assertStatus(201)->assertJsonPath('data.employee_id', '20190123');
        $this->assertDatabaseHas('users', ['email' => 'maria@msumain.edu.ph', 'employee_id' => '20190123']);
    }

    public function test_staff_set_or_correct_it_on_their_profile_and_students_cannot(): void
    {
        $supervisor = $this->makeUser('supervisor');
        $this->makeUser('admin', ['employee_id' => '11112222']);
        Sanctum::actingAs($supervisor);

        $this->putJson('/api/profile', ['employee_id' => '11112222'])->assertStatus(422)
            ->assertJsonPath('errors.employee_id.0', 'This employee ID is already used by another account.');
        $this->putJson('/api/profile', ['employee_id' => '33334444'])->assertOk()
            ->assertJsonPath('data.employee_id', '33334444');
        // Saving the same value again is not a conflict with itself.
        $this->putJson('/api/profile', ['employee_id' => '33334444'])->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'profile_updated', 'user_id' => $supervisor->id]);

        Sanctum::actingAs($student = $this->makeUser('recipient'));
        $this->putJson('/api/profile', ['employee_id' => '99990000'])->assertStatus(422)
            ->assertJsonPath('errors.employee_id.0', 'Only supervisors and admins have an employee ID.');
        $this->assertNull($student->fresh()->employee_id);
    }

    public function test_admins_find_staff_by_employee_id_and_see_it_on_renewals(): void
    {
        $supervisor = $this->makeUser('supervisor', ['employee_id' => '20190123']);
        $recipient = $this->makeUser('recipient');
        StudentProfile::create([
            'user_id' => $recipient->id, 'student_id_number' => '202512345', 'first_name' => 'Amir', 'last_name' => 'Alonto',
            'college' => 'CICS', 'program' => 'BSIT', 'year_level' => 3,
        ]);
        $this->makeAssignment($recipient, $supervisor);
        $renewal = Application::create(['user_id' => $recipient->id, 'academic_year' => '2024-2025', 'semester' => '2nd Semester', 'status' => 'submitted', 'type' => 'renewal']);
        Sanctum::actingAs($this->makeUser('admin'));

        $this->getJson('/api/admin/users?search=2019012')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $supervisor->id)
            ->assertJsonPath('data.0.employee_id', '20190123');

        $this->getJson("/api/admin/applications/{$renewal->id}")->assertOk()
            ->assertJsonPath('data.renewal_context.supervisor_employee_id', '20190123');
    }
}
