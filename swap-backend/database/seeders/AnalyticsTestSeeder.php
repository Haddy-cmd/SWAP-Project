<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\Assignment;
use App\Models\Office;
use App\Models\StudentProfile;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Seeds throwaway analytics test data:
 *   - 100 applicants (with applications across colleges & statuses)
 *   - 200 recipients (active assignments + verified/pending time logs + stipends)
 *   - 6 supervisors (assigned across offices)
 *
 * All rows use @test.swap emails so the seeder is fully re-runnable (it wipes
 * its own previous data first). Run with:
 *   php artisan db:seed --class=AnalyticsTestSeeder
 */
class AnalyticsTestSeeder extends Seeder
{
    private string $year = '2025-2026';
    private string $sem = '1st Semester';

    private array $colleges = [
        ['CICS', 'BS Computer Science'],
        ['CED', 'Bachelor of Secondary Education'],
        ['CBAA', 'BS Accountancy'],
        ['CoE', 'BS Civil Engineering'],
        ['CNSM', 'BS Biology'],
        ['CSSH', 'AB Political Science'],
        ['CHS', 'BS Nursing'],
        ['CPA', 'BS Social Work'],
    ];

    public function run(): void
    {
        $semStart = Carbon::parse('2025-08-04'); // a Monday
        $password = Hash::make('Password123!');

        DB::transaction(function () use ($semStart, $password) {
            $this->wipePrevious();

            $offices = Office::where('is_active', true)->get();
            if ($offices->isEmpty()) {
                $this->command->warn('No offices found — run OfficeSeeder first.');
                return;
            }

            // ── 6 Supervisors, spread across offices ───────────────────────────
            $supervisors = [];
            for ($i = 1; $i <= 6; $i++) {
                $office = $offices[($i - 1) % $offices->count()];
                $supervisors[] = User::create([
                    'name' => 'Supervisor ' . fake()->lastName(),
                    'email' => "supervisor{$i}@test.swap",
                    'password' => $password,
                    'role' => 'supervisor',
                    'is_active' => true,
                    'office_id' => $office->id,
                    'email_verified_at' => now(),
                ]);
            }
            $supByOffice = collect($supervisors)->groupBy('office_id');

            // ── 200 Recipients: assignment + time logs + stipend ───────────────
            $timeLogs = [];
            $stipends = [];
            for ($i = 1; $i <= 200; $i++) {
                [$collegeCode, $program] = $this->colleges[array_rand($this->colleges)];
                $office = $offices[$i % $offices->count()];
                $sup = ($supByOffice[$office->id] ?? collect($supervisors))->first() ?? $supervisors[0];

                $user = User::create([
                    'name' => fake()->firstName() . ' ' . fake()->lastName(),
                    'email' => "recipient{$i}@test.swap",
                    'password' => $password,
                    'role' => 'recipient',
                    'is_active' => true,
                    'email_verified_at' => now(),
                ]);
                StudentProfile::create([
                    'user_id' => $user->id,
                    'student_id_number' => sprintf('T25-R-%03d', $i),
                    'first_name' => fake()->firstName(),
                    'last_name' => fake()->lastName(),
                    'contact_number' => '+639' . fake()->numerify('#########'),
                    'college' => $collegeCode,
                    'program' => $program,
                    'year_level' => rand(1, 4),
                ]);
                $assignment = Assignment::create([
                    'user_id' => $user->id,
                    'office_id' => $office->id,
                    'supervisor_id' => $sup->id,
                    'academic_year' => $this->year,
                    'semester' => $this->sem,
                    'required_hours' => 200,
                    'start_date' => $semStart->toDateString(),
                    'end_date' => $semStart->copy()->addMonths(5)->toDateString(),
                    'status' => 'active',
                    'qr_secret' => Str::random(64),
                ]);

                // Verified hours (drive completion rate + weekly trend)
                $verifiedLogs = rand(6, 12);
                for ($j = 0; $j < $verifiedLogs; $j++) {
                    $date = $semStart->copy()->addWeeks(rand(0, 9))->addDays(rand(0, 4));
                    $in = $date->copy()->setTime(8, 0);
                    $out = $in->copy()->addHours(rand(4, 9));
                    $timeLogs[] = [
                        'assignment_id' => $assignment->id,
                        'user_id' => $user->id,
                        'date' => $date->toDateString(),
                        'time_in' => $in->toDateTimeString(),
                        'time_out' => $out->toDateTimeString(),
                        'status' => 'verified',
                        'verified_by' => $sup->id,
                        'verified_at' => $out->copy()->addDay()->toDateTimeString(),
                        'created_at' => $in->toDateTimeString(),
                        'updated_at' => $in->toDateTimeString(),
                    ];
                }
                // A couple of pending-verification logs
                for ($j = 0; $j < rand(1, 2); $j++) {
                    $date = $semStart->copy()->addWeeks(rand(7, 9))->addDays(rand(0, 4));
                    $in = $date->copy()->setTime(8, 0);
                    $out = $in->copy()->addHours(rand(4, 8));
                    $timeLogs[] = [
                        'assignment_id' => $assignment->id,
                        'user_id' => $user->id,
                        'date' => $date->toDateString(),
                        'time_in' => $in->toDateTimeString(),
                        'time_out' => $out->toDateTimeString(),
                        'status' => 'pending_verification',
                        'verified_by' => null,
                        'verified_at' => null,
                        'created_at' => $in->toDateTimeString(),
                        'updated_at' => $in->toDateTimeString(),
                    ];
                }

                // Stipend: ~60% released, ~25% pending, rest none
                $roll = rand(1, 100);
                if ($roll <= 85) {
                    $stipends[] = [
                        'user_id' => $user->id,
                        'amount' => 1000,
                        'academic_year' => $this->year,
                        'semester' => $this->sem,
                        'period_label' => "{$this->sem}, AY {$this->year}",
                        'status' => $roll <= 60 ? 'released' : 'pending',
                        'released_at' => $roll <= 60 ? now()->toDateTimeString() : null,
                        'created_at' => now()->toDateTimeString(),
                        'updated_at' => now()->toDateTimeString(),
                    ];
                }

                if (count($timeLogs) >= 1000) {
                    DB::table('time_logs')->insert($timeLogs);
                    $timeLogs = [];
                }
            }
            if ($timeLogs) {
                DB::table('time_logs')->insert($timeLogs);
            }
            if ($stipends) {
                DB::table('stipend_history')->insert($stipends);
            }

            // ── 100 Applicants with applications ───────────────────────────────
            $statuses = array_merge(
                array_fill(0, 30, 'submitted'),
                array_fill(0, 25, 'under_review'),
                array_fill(0, 15, 'interview_scheduled'),
                array_fill(0, 20, 'approved'),
                array_fill(0, 10, 'rejected'),
            );
            shuffle($statuses);

            $applications = [];
            for ($i = 1; $i <= 100; $i++) {
                [$collegeCode, $program] = $this->colleges[array_rand($this->colleges)];
                $user = User::create([
                    'name' => fake()->firstName() . ' ' . fake()->lastName(),
                    'email' => "applicant{$i}@test.swap",
                    'password' => $password,
                    'role' => 'applicant',
                    'is_active' => true,
                    'email_verified_at' => now(),
                ]);
                StudentProfile::create([
                    'user_id' => $user->id,
                    'student_id_number' => sprintf('T25-A-%03d', $i),
                    'first_name' => fake()->firstName(),
                    'last_name' => fake()->lastName(),
                    'contact_number' => '+639' . fake()->numerify('#########'),
                    'college' => $collegeCode,
                    'program' => $program,
                    'year_level' => rand(1, 4),
                ]);
                // Spread submissions across the semester months for the monthly chart.
                $createdAt = $semStart->copy()->addDays(rand(0, 150))->setTime(rand(8, 16), rand(0, 59));
                $applications[] = [
                    'user_id' => $user->id,
                    'academic_year' => $this->year,
                    'semester' => $this->sem,
                    'status' => $statuses[$i - 1],
                    'created_at' => $createdAt->toDateTimeString(),
                    'updated_at' => $createdAt->toDateTimeString(),
                ];
            }
            DB::table('applications')->insert($applications);

            $this->command->info('Seeded: 100 applicants, 200 recipients, 6 supervisors for ' . $this->year . ' · ' . $this->sem);
        });
    }

    /** Remove any previously-seeded @test.swap data so re-runs stay clean. */
    private function wipePrevious(): void
    {
        $ids = User::withTrashed()->where('email', 'like', '%@test.swap')->pluck('id');
        if ($ids->isEmpty()) {
            return;
        }
        DB::table('time_logs')->whereIn('user_id', $ids)->delete();
        DB::table('stipend_history')->whereIn('user_id', $ids)->delete();
        DB::table('assignments')->whereIn('user_id', $ids)->delete(); // before deleting supervisors (restrictOnDelete)
        DB::table('applications')->whereIn('user_id', $ids)->delete();
        DB::table('student_profiles')->whereIn('user_id', $ids)->delete();
        DB::table('users')->whereIn('id', $ids)->delete();
    }
}
