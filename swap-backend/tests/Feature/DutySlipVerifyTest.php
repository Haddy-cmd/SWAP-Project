<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\StudentProfile;
use App\Models\TimeLog;
use App\Models\User;
use App\Support\DutySlipControl;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\MakesSwapData;
use Tests\TestCase;

/**
 * Admin "Verify Slip": the recorded hours it reports must follow the printed slips'
 * rules — rejected logs never count, bonus (manual) hours do, and a semester slip
 * covers only its own term.
 */
class DutySlipVerifyTest extends TestCase
{
    use RefreshDatabase, MakesSwapData;

    private const SID = '20190004'; // student id "2019-0004" with punctuation stripped

    private User $recipient;
    private Assignment $firstSem;
    private Assignment $secondSem;

    protected function setUp(): void
    {
        parent::setUp();

        $supervisor = $this->makeUser('supervisor');
        $this->recipient = $this->makeUser('recipient');
        StudentProfile::create([
            'user_id' => $this->recipient->id,
            'student_id_number' => '2019-0004',
            'first_name' => 'Norhana',
            'last_name' => 'Macarimbang',
            'college' => 'CNSM',
            'program' => 'BSMATH',
            'year_level' => 4,
        ]);

        $this->firstSem = $this->makeAssignment($this->recipient, $supervisor, null, [
            'academic_year' => '2024-2025', 'semester' => '1st Semester', 'status' => 'completed',
        ]);
        $this->secondSem = $this->makeAssignment($this->recipient, $supervisor, null, [
            'academic_year' => '2024-2025', 'semester' => '2nd Semester', 'status' => 'active',
        ]);

        Sanctum::actingAs($this->makeUser('admin'));
    }

    /** A completed log; duration_hours is a generated column, so hours come from the times. */
    private function log(Assignment $a, string $date, int $hours, string $status, bool $bonus = false): void
    {
        $in = Carbon::parse("{$date} 08:00:00");
        TimeLog::create([
            'assignment_id' => $a->id,
            'user_id' => $this->recipient->id,
            'date' => $date,
            'time_in' => $in,
            'time_out' => $in->copy()->addHours($hours),
            'status' => $status,
            'is_manual' => $bonus,
        ]);
    }

    private function control(string $ay, string $sem, string $range): string
    {
        $sid = self::SID;
        return "SWAP-{$sid}-{$ay}{$sem}-{$range}-" . DutySlipControl::checksum($sid, $ay, $sem, $range);
    }

    private function verify(string $controlNo)
    {
        return $this->getJson('/api/admin/duty-slip/verify?control_no=' . urlencode($controlNo))->assertOk();
    }

    public function test_semester_slip_counts_only_its_term_and_ignores_rejected_logs(): void
    {
        $this->log($this->firstSem, '2024-09-02', 4, 'verified');
        $this->log($this->firstSem, '2024-09-03', 3, 'pending_verification');
        $this->log($this->firstSem, '2024-09-04', 5, 'rejected');
        $this->log($this->firstSem, '2024-09-05', 2, 'verified', bonus: true);
        $this->log($this->secondSem, '2025-02-03', 6, 'verified');

        $this->verify($this->control('2425', 'S1', 'SEM'))
            ->assertJsonPath('data.valid', true)
            ->assertJsonPath('data.recipient_found', true)
            ->assertJsonPath('data.recorded_hours', 9) // 4 + 3 + 2 bonus; the rejected 5 never counts
            ->assertJsonPath('data.range', 'Whole semester — 1st Semester, AY 2024-2025');

        $this->verify($this->control('2425', 'S2', 'SEM'))
            ->assertJsonPath('data.recorded_hours', 6);
    }

    public function test_week_slip_excludes_rejected_logs(): void
    {
        // Week of Monday Sep 2, 2024.
        $this->log($this->firstSem, '2024-09-03', 4, 'verified');
        $this->log($this->firstSem, '2024-09-04', 5, 'rejected');
        $this->log($this->firstSem, '2024-09-06', 1, 'verified', bonus: true);
        $this->log($this->firstSem, '2024-09-10', 8, 'verified'); // next week

        $this->verify($this->control('2425', 'S1', 'W20240902'))
            ->assertJsonPath('data.valid', true)
            ->assertJsonPath('data.recorded_hours', 5); // 4 regular + 1 bonus
    }

    public function test_a_tampered_checksum_is_invalid(): void
    {
        $good = $this->control('2425', 'S1', 'SEM');
        $tampered = substr($good, 0, -1) . (str_ends_with($good, 'A') ? 'B' : 'A');

        $this->verify($tampered)->assertJsonPath('data.valid', false);
    }

    public function test_an_unrecognised_range_is_invalid_even_with_a_matching_checksum(): void
    {
        $this->log($this->firstSem, '2024-09-02', 4, 'verified');

        // Well-formed and correctly checksummed, but no slip the system prints.
        $this->verify($this->control('2425', 'S1', 'X123'))
            ->assertJsonPath('data.valid', false)
            ->assertJsonPath('data.reason', 'This control number has an unrecognised coverage range.')
            ->assertJsonMissingPath('data.recorded_hours');

        // An impossible week date is not a slip either.
        $this->verify($this->control('2425', 'S1', 'W20241399'))
            ->assertJsonPath('data.valid', false);
    }

    public function test_a_semester_slip_without_a_year_reports_no_hours(): void
    {
        $this->log($this->firstSem, '2024-09-02', 4, 'verified');

        // "0000" decodes to no academic year: summing the semester across all
        // years would report a number no slip ever printed.
        $this->verify($this->control('0000', 'S1', 'SEM'))
            ->assertJsonPath('data.valid', true)
            ->assertJsonPath('data.recorded_hours', null)
            ->assertJsonPath('data.range', 'Whole semester — 1st Semester, AY unknown');
    }
}
