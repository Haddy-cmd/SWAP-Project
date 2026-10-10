<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\StudentProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/** Profile → Activity (your own audit entries), "Last changed" and the phone rule. */
class ProfileActivityTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    public function test_activity_lists_only_what_you_did_as_plain_sentences(): void
    {
        $user = $this->makeUser('recipient', ['name' => 'Juan Dela Cruz']);
        $admin = $this->makeUser('admin');
        AuditLog::record('photo_updated', $user, null, ['avatar_path' => 'a.png'], $user->id);
        AuditLog::record('profile_updated', $user, ['name' => 'Juan'], ['name' => 'Juan Dela Cruz'], $user->id);
        AuditLog::record('profile_updated', $admin, null, ['name' => 'X'], $admin->id); // someone else's
        AuditLog::record('testing_role_changed', $user, null, null, $user->id);        // System Testing noise

        Sanctum::actingAs($user);
        $res = $this->getJson('/api/profile/activity')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.summary', 'Updated your profile')
            ->assertJsonPath('data.0.area', 'accounts')
            ->assertJsonPath('data.1.summary', 'Changed your photo');
        $this->assertArrayNotHasKey('changes', $res->json('data.0'));
        $this->assertArrayNotHasKey('ip_address', $res->json('data.0'));
    }

    public function test_profile_reports_when_the_password_last_changed(): void
    {
        $user = $this->makeUser('recipient');
        Sanctum::actingAs($user);
        $this->getJson('/api/profile')->assertOk()->assertJsonPath('data.password_changed_at', null);

        $this->putJson('/api/profile/password', [
            'current_password' => 'Password@123', 'password' => 'NewPassword@456', 'password_confirmation' => 'NewPassword@456',
        ])->assertOk();

        $this->assertNotNull($this->getJson('/api/profile')->json('data.password_changed_at'));
        $this->getJson('/api/profile/activity')->assertJsonPath('data.0.summary', 'Changed your password');
    }

    public function test_phone_numbers_must_be_11_digits(): void
    {
        $user = $this->makeUser('applicant');
        StudentProfile::create([
            'user_id' => $user->id, 'student_id_number' => '202512345', 'first_name' => 'Amir', 'last_name' => 'Alonto',
            'college' => 'CICS', 'program' => 'BSIT', 'year_level' => 3,
        ]);
        Sanctum::actingAs($user);

        $this->putJson('/api/profile', ['contact_number' => '0917 123-4567'])->assertOk();
        $this->assertSame('09171234567', $user->profile()->value('contact_number'));

        $this->putJson('/api/profile', ['contact_number' => '12345'])->assertStatus(422)
            ->assertJsonPath('errors.contact_number.0', 'Use 11 digits, e.g. 0917 123 4567.');
        $this->putJson('/api/profile', ['contact_number' => '+63 917 123 4567'])->assertStatus(422);

        $this->putJson('/api/profile', ['contact_number' => ''])->assertOk();
        $this->assertNull($user->profile()->value('contact_number'));
    }
}
