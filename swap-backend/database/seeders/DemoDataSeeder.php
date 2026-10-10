<?php

namespace Database\Seeders;

use App\Models\Office;
use App\Models\SemesterPeriod;
use App\Models\User;
use App\Support\DutySlipControl;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Demo data for the current term, in every state the portal shows:
 *   - 200 applicants (new applications: submitted, under review, interview scheduled, rejected)
 *   - 100 new recipients (approved + interviewed, placed in an office, first duty logs)
 *   - 50 renewing recipients with a finished previous term and a renewal for this one:
 *       15 approved (rolled over), 20 ready to approve, and 15 blocked or covered for a
 *       reason the renewal gate reports (stipend owed, report not accepted, not eligible,
 *       deficient with an approved promissory note)
 *
 * Every account is `…@demo.swap` (password `Password123!`), so the seeder is re-runnable
 * (it removes its own previous rows first) and leaves real data alone. No emails are
 * sent: rows are written directly, not through the services. Run with:
 *   php artisan db:seed --class=DemoDataSeeder
 */
class DemoDataSeeder extends Seeder
{
    private const DOMAIN = 'demo.swap';
    private const PASSWORD = 'Password123!';

    /**
     * The registration form's colleges and programs (official masterlist AY 2025–2026, main campus);
     * weights ≈ enrolment.
     */
    private const COLLEGES = [
        ['CICS', 12, ['BS Computer Science', 'BS Information Systems', 'BS Information Technology (Database Systems)', 'BS Information Technology (Network Systems)']],
        ['CBAA', 11, ['BS Accountancy', 'BS Entrepreneurship', 'BSBA Business Economics', 'BSBA Human Resource Management', 'BSBA Marketing Management (Advertising)', 'BSBA Marketing Management (Digital Marketing)']],
        ['CED', 11, ['BSEd English', 'BSEd Filipino', 'BSEd Mathematics', 'BSEd Sciences', 'BSEd Social Studies', 'BTLEd Home Economics', 'BTVTEd Home Economics', 'Bachelor of Early Childhood Education (BECEd)', 'Bachelor of Elementary Education (BEEd)']],
        ['CoE', 10, ['BS Agricultural and Biosystems Engineering', 'BS Chemical Engineering', 'BS Civil Engineering', 'BS Civil Engineering (Structural)', 'BS Electrical Engineering', 'BS Electronics Engineering', 'BS Mechanical Engineering']],
        ['CSSH', 9, ['AB Communication Studies major in Devt. Com.', 'AB Communication Studies major in Journalism', 'BA Communication Studies (Media Education)', 'BA English Language Studies', 'BA Filipino', 'BA History International History Track', 'BA History Philippine and Asian History Track', 'BA History Public History/Development Track', 'BA Journalism', 'BA Literary and Cultural Studies', 'BA Panitikan', 'BA Philosophy', 'BA Political Science', 'BA Psychology', 'BA Sociology', 'BS Development Communication', 'BS Psychology', 'Bachelor of Library and Information Science']],
        ['CNSM', 8, ['BS Biology (Animal Biology)', 'BS Chemistry', 'BS Mathematics', 'BS Physics', 'BS Statistics', 'Certificate in Statistics']],
        ['CHS', 7, ['BS Midwifery', 'BS Nursing', 'BS Pharmacy']],
        ['CPA', 6, ['BS Social Work', 'BS Sustainable Community Development', 'Bachelor of Public Administration']],
        ['KFCIAAS', 6, ['AB Islamic Studies major in Shariah', 'BS International Relations', 'BS Islamic Banking and Finance', 'BS Teaching Arabic']],
        ['CA', 5, ['BS Agribusiness Management', 'BS Agricultural Business Management', 'BS Agriculture (Major in Animal Science)', 'BS Agriculture major in Agricultural Food Processing', 'BS Agriculture major in Agronomy', 'BS Agriculture major in Extension Education', 'BSA Agricultural Extension', 'BSA Farming Systems', 'BSA Horticulture', 'BSA Soil Science', 'BSA major in Food Processing', 'DABMT-Food Processing', 'DAT Crop Production Technology']],
        ['CHTM', 4, ['BS Hospitality Management', 'BS Tourism Management']],
        ['CFES', 3, ['BS Environmental Science', 'BS Forestry', 'BS Forestry major in Agroforestry']],
        ['CSPEAR', 3, ['BS Physical Education']],
        ['DET', 3, ['BSET Construction Engineering Management', 'BSET Electrical and Renewable Energy', 'BSET Machining and Fabrication', 'DT Machine Shop Technology', 'Diploma in Electrical Technology major in Renewable Energy', 'Diploma in Technology Major in Construction Technology']],
        ['CF', 2, ['BS Fisheries', 'Diploma in Fisheries Technology (Ladderized Program) Major in Aquaculture', 'Diploma in Fisheries Technology (Ladderized Program) Major in Fish Processing']],
    ];

    private const FIRST = ['Abdul', 'Aisah', 'Alinor', 'Amina', 'Amirah', 'Anisah', 'Asnawi', 'Bai', 'Bashir', 'Farida', 'Fatimah', 'Hadji', 'Hamid',
        'Haron', 'Jamal', 'Jamila', 'Johaira', 'Khalid', 'Laila', 'Mohammad', 'Monera', 'Naila', 'Nasrullah', 'Norhana', 'Norhaya', 'Omar',
        'Potri', 'Rahima', 'Rashid', 'Rohaniah', 'Saddam', 'Sahara', 'Samira', 'Sittie', 'Sohaira', 'Tarhata', 'Usman', 'Yasmin', 'Zainab',
        'Zulfikar', 'Angela', 'Carlo', 'Christine', 'Daniel', 'Ella', 'Gabriel', 'Jasmine', 'John Paul', 'Kristine', 'Mark', 'Mary Grace',
        'Miguel', 'Nicole', 'Paolo', 'Patricia', 'Rhea', 'Ryan', 'Stephanie'];

    private const LAST = ['Abdullah', 'Acmad', 'Adiong', 'Alonto', 'Ampaso', 'Balindong', 'Basman', 'Batua', 'Cali', 'Dimakuta', 'Dimaporo',
        'Disomimba', 'Guro', 'Lucman', 'Macabando', 'Macarambon', 'Macapodi', 'Mamalampac', 'Mangondato', 'Marohom', 'Mimbantas', 'Norodin',
        'Pangandaman', 'Panggaga', 'Radiamoda', 'Sarip', 'Sultan', 'Tomawis', 'Usop', 'Yahya', 'Aquino', 'Bautista', 'Cruz', 'Dela Cruz',
        'Garcia', 'Lim', 'Mendoza', 'Ramos', 'Reyes', 'Santos', 'Torres', 'Villanueva'];

    private const TASKS = [
        'Encoded and filed incoming student records; assisted walk-in clients at the front desk.',
        'Sorted and shelved returned books; helped students locate references in the catalogue.',
        'Prepared photocopies of forms for the office and organized the document cabinets.',
        'Assisted the staff in releasing certificates and logging transactions in the record book.',
        'Updated the office inventory sheet and delivered memos to other offices on campus.',
        'Helped set up the venue for the orientation program and registered attendees.',
        'Scanned and renamed archived documents for the digital filing system.',
        'Answered phone inquiries and guided students on the requirements for their requests.',
    ];

    private string $now;
    private int $seq = 0;
    /** @var array<string, true> */
    private array $usedIds = [];
    /** @var array<string, true> */
    private array $usedNames = [];

    public function run(): void
    {
        $this->now = now()->toDateTimeString();

        $term = SemesterPeriod::orderByDesc('renewal_open')->orderByDesc('start_date')->first();
        if (!$term) {
            $this->command->error('Set up a semester period first (Admin → Semesters).');
            return;
        }
        $admin = User::where('role', 'admin')->orderBy('id')->first();
        $offices = Office::where('is_active', true)->orderBy('id')->get();
        $supervisors = User::where('role', 'supervisor')->where('is_active', true)->whereNotNull('office_id')->get();
        if (!$admin || $offices->isEmpty() || $supervisors->isEmpty()) {
            $this->command->error('Needs an admin, active offices and supervisors with an office (run the base seeders first).');
            return;
        }

        $this->command->info("Term: {$term->semester} {$term->academic_year} ({$term->start_date->toDateString()} – {$term->end_date->toDateString()})");
        $files = $this->sampleFiles();

        DB::transaction(function () use ($term, $admin, $offices, $supervisors, $files) {
            $this->wipePrevious();
            $this->usedIds = array_fill_keys(DB::table('student_profiles')->pluck('student_id_number')->filter()->all(), true);

            $this->seedApplicants($term, $admin, $files);
            $this->seedNewRecipients($term, $admin, $offices, $supervisors, $files);
            $this->seedRenewals($term, $admin, $offices, $supervisors, $files);
        });

        $this->command->info('Done: 200 applicants, 100 new recipients, 50 renewals. Sign in as any …@' . self::DOMAIN . ' account with ' . self::PASSWORD);
    }

    // ── cohorts ──────────────────────────────────────────────────────────────

    private function seedApplicants(SemesterPeriod $term, User $admin, array $files): void
    {
        $statuses = array_merge(
            array_fill(0, 70, 'submitted'),
            array_fill(0, 50, 'under_review'),
            array_fill(0, 40, 'interview_scheduled'),
            array_fill(0, 40, 'rejected'),
        );
        shuffle($statuses);
        $rejections = [
            'Your general weighted average does not meet the program requirement this semester.',
            'Incomplete requirements: your Certificate of Registration was not attached.',
            'All slots for this semester have been filled. You are welcome to apply again next semester.',
            'You did not attend your scheduled interview.',
        ];

        foreach ($statuses as $i => $status) {
            $user = $this->student('applicant');
            $submitted = Carbon::parse($term->start_date)->subDays(rand(3, 25))->setTime(rand(8, 16), rand(0, 59));
            $reviewed = in_array($status, ['under_review', 'interview_scheduled', 'rejected'], true);

            $appId = DB::table('applications')->insertGetId([
                'user_id' => $user->id, 'academic_year' => $term->academic_year, 'semester' => $term->semester,
                'status' => $status, 'type' => 'new',
                'remarks' => $status === 'rejected' ? $rejections[$i % count($rejections)] : null,
                'reviewed_by' => $reviewed ? $admin->id : null,
                'reviewed_at' => $reviewed ? $submitted->copy()->addDays(rand(1, 3))->toDateTimeString() : null,
                'created_at' => $submitted->toDateTimeString(), 'updated_at' => $this->now,
            ]);
            $this->documents($appId, $files, ['cor', 'grades', 'letter_of_intent', 'id_photo'], $submitted);

            if ($status === 'interview_scheduled') {
                $this->interview($appId, $this->upcomingSlot(), 'scheduled');
            } elseif ($status === 'rejected' && $i % count($rejections) === 3) {
                $this->interview($appId, $submitted->copy()->addDays(4)->setTime(9, 0), 'no_show');
            }
        }
        $this->command->line('  · 200 applicants');
    }

    private function seedNewRecipients(SemesterPeriod $term, User $admin, $offices, $supervisors, array $files): void
    {
        $start = Carbon::parse($term->start_date);

        for ($i = 0; $i < 100; $i++) {
            $user = $this->student('recipient');
            $submitted = $start->copy()->subDays(rand(14, 30))->setTime(rand(8, 16), rand(0, 59));
            $interviewed = $submitted->copy()->addDays(rand(4, 7))->setTime(rand(8, 15), 0);
            $approved = $interviewed->copy()->addDays(rand(1, 3));

            $appId = DB::table('applications')->insertGetId([
                'user_id' => $user->id, 'academic_year' => $term->academic_year, 'semester' => $term->semester,
                'status' => 'approved', 'type' => 'new', 'remarks' => null,
                'reviewed_by' => $admin->id, 'reviewed_at' => $approved->toDateTimeString(),
                'created_at' => $submitted->toDateTimeString(), 'updated_at' => $approved->toDateTimeString(),
            ]);
            $this->documents($appId, $files, ['cor', 'grades', 'letter_of_intent', 'id_photo'], $submitted);
            // An interview that took place stays `scheduled`; only a no-show changes it.
            $this->interview($appId, $interviewed, 'scheduled');

            [$office, $supervisor] = $this->placement($offices, $supervisors, $i);
            $assignmentId = $this->assignment($user, $office, $supervisor, $term->academic_year, $term->semester, $start, null, 'active', 200);
            $this->firstWeekLogs($assignmentId, $user, $office, $supervisor, $start);
        }
        $this->command->line('  · 100 new recipients');
    }

    /**
     * Renewing recipients: a finished 2nd Semester of the previous school year, then a renewal
     * for the current term, in the states the renewal gate (RenewalReadinessService) knows.
     */
    private function seedRenewals(SemesterPeriod $term, User $admin, $offices, $supervisors, array $files): void
    {
        [$y1, $y2] = array_map('intval', explode('-', $term->academic_year));
        $prevYear = ($y1 - 1) . '-' . ($y2 - 1);
        $prevSem = '2nd Semester';
        $prevStart = Carbon::create($y1, 1, 12);
        $prevEnd = Carbon::create($y1, 5, 22);

        // [count, verdict, paid, report: missing|submitted|eligible|not_eligible, note, renewal status]
        $cohorts = [
            [15, 'qualified', true, 'eligible', false, 'approved'],
            [20, 'qualified', true, 'eligible', false, 'submitted'],
            [5, 'qualified', false, 'eligible', false, 'submitted'],   // blocked: stipend owed
            [4, 'qualified', true, 'submitted', false, 'submitted'],   // blocked: report not accepted yet
            [3, 'qualified', true, 'not_eligible', false, 'submitted'], // blocked: marked not eligible
            [3, 'deficient', false, 'submitted', true, 'submitted'],   // covered by an approved note
        ];

        $n = 0;
        foreach ($cohorts as [$count, $verdict, $paid, $report, $note, $renewalStatus]) {
            for ($k = 0; $k < $count; $k++, $n++) {
                $user = $this->student('recipient', minYear: 2);
                [$office, $supervisor] = $this->placement($offices, $supervisors, $n + 3);
                $short = $verdict === 'deficient' ? rand(8, 30) : 0;

                // The previous term: placed, worked, judged, reported, paid.
                $prevApp = $prevStart->copy()->subDays(rand(20, 40));
                DB::table('applications')->insert([
                    'user_id' => $user->id, 'academic_year' => $prevYear, 'semester' => $prevSem, 'status' => 'approved', 'type' => 'new',
                    'reviewed_by' => $admin->id, 'reviewed_at' => $prevApp->copy()->addDays(7)->toDateTimeString(),
                    'created_at' => $prevApp->toDateTimeString(), 'updated_at' => $prevApp->toDateTimeString(),
                ]);
                $prevId = $this->assignment($user, $office, $supervisor, $prevYear, $prevSem, $prevStart, $prevEnd,
                    $renewalStatus === 'approved' ? 'completed' : 'active', 200, [
                        'term_status' => $verdict,
                        'deficient_hours' => $short ?: null,
                        'term_status_at' => $prevEnd->copy()->addDay()->setTime(0, 10)->toDateTimeString(),
                    ]);
                $this->termLogs($prevId, $user, $office, $supervisor, $prevStart, 200 - $short);

                if ($report !== 'missing') {
                    $accepted = in_array($report, ['eligible', 'not_eligible'], true);
                    DB::table('term_reports')->insert([
                        'assignment_id' => $prevId, 'user_id' => $user->id,
                        'content' => 'During the semester I assisted the office staff in daily operations: receiving and logging documents, helping students with their inquiries, and keeping the files organized. I learned to manage my time between classes and duty.',
                        'accomplishments' => 'Completed the digital filing of archived records; helped during enrolment week.',
                        'challenges' => 'Balancing duty hours with laboratory classes.',
                        'submitted_at' => $prevEnd->copy()->subDays(rand(1, 10))->toDateTimeString(),
                        'reviewed_at' => $accepted ? $prevEnd->copy()->addDays(rand(2, 9))->toDateTimeString() : null,
                        'reviewed_by' => $accepted ? $supervisor->id : null,
                        'renewal_eligible' => $accepted ? $report === 'eligible' : null,
                        'review_remarks' => $report === 'not_eligible' ? 'Frequent absences without notice during the last month of the semester.' : null,
                        'created_at' => $this->now, 'updated_at' => $this->now,
                    ]);
                }

                $noteId = null;
                if ($note) {
                    $noteId = DB::table('promissory_notes')->insertGetId([
                        'assignment_id' => $prevId, 'user_id' => $user->id, 'academic_year' => $prevYear, 'semester' => $prevSem,
                        'verified_hours_snapshot' => 200 - $short, 'deficient_hours' => $short, 'lacking_hours' => $short,
                        'file_path' => $files['pdf'], 'file_name' => 'promissory-note.pdf', 'mime_type' => 'application/pdf', 'file_size' => $files['pdf_size'],
                        'reason' => 'I was hospitalized for two weeks in March and could not report for duty. I promise to render the lacking hours next semester.',
                        'status' => 'approved', 'reviewed_by' => $supervisor->id,
                        'reviewed_at' => $prevEnd->copy()->addDays(5)->toDateTimeString(), 'review_remarks' => 'Medical certificate attached. Approved.',
                        'created_at' => $prevEnd->copy()->addDays(2)->toDateTimeString(), 'updated_at' => $this->now,
                    ]);
                }

                if ($paid) {
                    $released = $prevEnd->copy()->addDays(rand(10, 30))->setTime(10, 0);
                    DB::table('stipend_history')->insert([
                        'user_id' => $user->id, 'amount' => 5000, 'academic_year' => $prevYear, 'semester' => $prevSem,
                        'period_label' => "{$prevSem} {$prevYear}", 'status' => 'released',
                        'control_number' => 'SWAP-STP-' . DutySlipControl::studentRef($user->sid) . '-' . DutySlipControl::termCode($prevYear, $prevSem),
                        'certified_by' => $admin->id, 'certified_at' => $released->toDateTimeString(),
                        'released_by' => $admin->id, 'released_at' => $released->toDateTimeString(),
                        'via_promissory' => $noteId !== null, 'promissory_note_id' => $noteId,
                        'required_hours' => 200, 'deficient_hours' => $short ?: null, 'lacking_hours' => $short ?: null,
                        'remarks' => 'Demo release.', 'created_at' => $released->toDateTimeString(), 'updated_at' => $released->toDateTimeString(),
                    ]);
                }

                // The renewal for the current term (with its updated COR).
                $renewedAt = Carbon::parse($term->start_date)->subDays(rand(1, 20))->setTime(rand(8, 16), rand(0, 59));
                $renewalId = DB::table('applications')->insertGetId([
                    'user_id' => $user->id, 'academic_year' => $term->academic_year, 'semester' => $term->semester,
                    'status' => $renewalStatus, 'type' => 'renewal',
                    'reviewed_by' => $renewalStatus === 'approved' ? $admin->id : null,
                    'reviewed_at' => $renewalStatus === 'approved' ? $renewedAt->copy()->addDays(2)->toDateTimeString() : null,
                    'created_at' => $renewedAt->toDateTimeString(), 'updated_at' => $this->now,
                ]);
                $this->documents($renewalId, $files, ['cor'], $renewedAt);

                if ($renewalStatus === 'approved') {
                    $start = Carbon::parse($term->start_date);
                    $newId = $this->assignment($user, $office, $supervisor, $term->academic_year, $term->semester, $start, null, 'active', 200);
                    $this->firstWeekLogs($newId, $user, $office, $supervisor, $start);
                }
            }
        }
        $this->command->line('  · 50 renewals (15 approved, 20 ready to approve, 15 blocked or covered by a note)');
    }

    // ── building blocks ──────────────────────────────────────────────────────

    /** A student account + profile with a unique name and 9-digit student ID. */
    private function student(string $role, int $minYear = 1): object
    {
        $this->seq++;
        do {
            $first = self::FIRST[array_rand(self::FIRST)];
            $last = self::LAST[array_rand(self::LAST)];
            $middle = self::LAST[array_rand(self::LAST)];
        } while (isset($this->usedNames["$first $middle $last"]) || $middle === $last);
        $this->usedNames["$first $middle $last"] = true;

        [$college, $programs] = $this->college();
        $program = $programs[array_rand($programs)];
        $maxYear = preg_match('/engineering/i', $program) || $program === 'BS Accountancy' ? 5 : 4;
        $year = rand(min($minYear, $maxYear), $maxYear);

        // Entry year follows the year level: a 3rd year in 2026 entered in 2024.
        $entry = (int) now()->format('Y') - $year + 1;
        do {
            $sid = $entry . str_pad((string) rand(0, 99999), 5, '0', STR_PAD_LEFT);
        } while (isset($this->usedIds[$sid]));
        $this->usedIds[$sid] = true;

        $slug = Str::slug("$first $last", '.');
        $id = DB::table('users')->insertGetId([
            'name' => "$first $middle $last",
            'email' => sprintf('%s.%03d@%s', $slug, $this->seq, self::DOMAIN),
            'password' => $this->hash(),
            'role' => $role,
            'is_active' => true,
            'email_verified_at' => $this->now,
            // Recipients carry a drawn specimen so their stipend can be released.
            'signature_image_path' => $role === 'recipient' ? 'demo/signature.png' : null,
            'require_clock_in_selfie' => true,
            'created_at' => $this->now, 'updated_at' => $this->now,
        ]);
        DB::table('student_profiles')->insert([
            'user_id' => $id, 'student_id_number' => $sid,
            'first_name' => $first, 'middle_name' => $middle, 'last_name' => $last,
            'contact_number' => '09' . rand(100000000, 999999999),
            'gender' => rand(0, 1) ? 'Male' : 'Female',
            'college' => $college, 'program' => $program, 'year_level' => $year,
            'created_at' => $this->now, 'updated_at' => $this->now,
        ]);

        return (object) ['id' => $id, 'sid' => $sid];
    }

    private ?string $hashed = null;

    private function hash(): string
    {
        return $this->hashed ??= Hash::make(self::PASSWORD);
    }

    /** @return array{0: string, 1: list<string>} a weighted-random college and its programs */
    private function college(): array
    {
        $total = array_sum(array_column(self::COLLEGES, 1));
        $pick = rand(1, $total);
        foreach (self::COLLEGES as [$code, $weight, $programs]) {
            if (($pick -= $weight) <= 0) {
                return [$code, $programs];
            }
        }

        return [self::COLLEGES[0][0], self::COLLEGES[0][2]];
    }

    /** Round-robin over offices; the office's own supervisor, else any (direct assignment). */
    private function placement($offices, $supervisors, int $i): array
    {
        $office = $offices[$i % $offices->count()];
        $supervisor = $supervisors->firstWhere('office_id', $office->id) ?? $supervisors[$i % $supervisors->count()];

        return [$office, $supervisor];
    }

    private function assignment(object $user, Office $office, User $supervisor, string $ay, string $sem, Carbon $start, ?Carbon $end, string $status, int $required, array $extra = []): int
    {
        return DB::table('assignments')->insertGetId($extra + [
            'user_id' => $user->id, 'office_id' => $office->id, 'supervisor_id' => $supervisor->id,
            'academic_year' => $ay, 'semester' => $sem, 'required_hours' => $required,
            'start_date' => $start->toDateString(), 'end_date' => $end?->toDateString(),
            'status' => $status, 'qr_secret' => Str::random(64),
            'created_at' => $start->copy()->subDays(2)->toDateTimeString(), 'updated_at' => $this->now,
        ]);
    }

    /** Weekday duty sessions adding up to roughly $hours, all verified, spread over the term. */
    private function termLogs(int $assignmentId, object $user, Office $office, User $supervisor, Carbon $start, int $hours): void
    {
        $rows = [];
        $day = $start->copy();
        $left = $hours;
        while ($left > 0) {
            if ($day->isWeekday() && rand(1, 100) <= 70) {
                $len = min($left, rand(3, 6));
                // Stored in UTC, worked in Manila (7–10 AM PHT).
                $in = Carbon::parse($day->toDateString() . ' ' . rand(7, 10) . ':' . [0, 15, 30][rand(0, 2)] . ':00', 'Asia/Manila')->utc();
                $rows[] = $this->logRow($assignmentId, $user, $office, $in, $len, 'verified', $supervisor);
                $left -= $len;
            }
            $day->addDay();
        }
        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('time_logs')->insert($chunk);
        }
    }

    /**
     * The term's first duty days so far (Mon–Sat up to yesterday, plus this morning if
     * the term has begun): most sessions verified, the latest ones still pending, each
     * with its Task Description.
     */
    private function firstWeekLogs(int $assignmentId, object $user, Office $office, User $supervisor, Carbon $start): void
    {
        $day = $start->copy();
        $today = now('Asia/Manila')->startOfDay();
        while ($day->lt($today)) {
            if (!$day->isSunday() && rand(1, 100) <= 75) {
                // Stored in UTC, worked in Manila: an 8:00 AM PHT shift is 00:00 UTC.
                $in = Carbon::parse($day->toDateString() . ' ' . rand(7, 13) . ':' . [0, 15, 30, 45][rand(0, 3)] . ':00', 'Asia/Manila')->utc();
                $recent = $day->copy()->addDays(2)->gte($today);
                $row = $this->logRow($assignmentId, $user, $office, $in, rand(2, 5), $recent ? 'pending_verification' : 'verified', $supervisor);
                $logId = DB::table('time_logs')->insertGetId($row);
                DB::table('narrative_reports')->insert([
                    'time_log_id' => $logId, 'content' => self::TASKS[array_rand(self::TASKS)],
                    'submitted_at' => $row['time_out'], 'created_at' => $row['time_out'], 'updated_at' => $row['time_out'],
                ]);
            }
            $day->addDay();
        }
    }

    private function logRow(int $assignmentId, object $user, Office $office, Carbon $in, int $hours, string $status, User $supervisor): array
    {
        $out = $in->copy()->addHours($hours);
        $jitter = fn () => (rand(-40, 40) / 100000);
        $lat = $office->latitude !== null ? (float) $office->latitude : null;
        $lng = $office->longitude !== null ? (float) $office->longitude : null;
        // A few fixes are poor enough to be flagged, as real phones produce.
        $flagged = rand(1, 100) <= 4;

        return [
            'assignment_id' => $assignmentId, 'user_id' => $user->id,
            'date' => $in->copy()->timezone('Asia/Manila')->toDateString(),
            'time_in' => $in->toDateTimeString(), 'time_out' => $out->toDateTimeString(),
            'status' => $status, 'clocked_out_reason' => 'manual',
            'verified_by' => $status === 'verified' ? $supervisor->id : null,
            'verified_at' => $status === 'verified' ? $out->copy()->addHours(rand(2, 30))->toDateTimeString() : null,
            'time_in_lat' => $lat !== null ? $lat + $jitter() : null, 'time_in_lng' => $lng !== null ? $lng + $jitter() : null,
            'time_out_lat' => $lat !== null ? $lat + $jitter() : null, 'time_out_lng' => $lng !== null ? $lng + $jitter() : null,
            'time_in_accuracy' => $flagged ? rand(120, 300) : rand(5, 40), 'time_out_accuracy' => rand(5, 40),
            'location_flagged' => $flagged, 'location_flag_reason' => $flagged ? 'GPS accuracy worse than 100 m' : null,
            'is_manual' => false,
            'created_at' => $in->toDateTimeString(), 'updated_at' => $out->toDateTimeString(),
        ];
    }

    private function documents(int $applicationId, array $files, array $types, Carbon $at): void
    {
        $names = ['cor' => 'COR.pdf', 'grades' => 'Grades.pdf', 'letter_of_intent' => 'Letter-of-Intent.pdf', 'id_photo' => '2x2-photo.png'];
        DB::table('application_documents')->insert(array_map(fn ($t) => [
            'application_id' => $applicationId, 'document_type' => $t,
            'file_path' => $t === 'id_photo' ? $files['png'] : $files['pdf'],
            'file_url' => rtrim(config('app.url'), '/') . '/api/documents/{DOC_ID}/file',
            'file_name' => $names[$t],
            'file_size' => $t === 'id_photo' ? $files['png_size'] : $files['pdf_size'],
            'mime_type' => $t === 'id_photo' ? 'image/png' : 'application/pdf',
            'created_at' => $at->toDateTimeString(), 'updated_at' => $at->toDateTimeString(),
        ], $types));
    }

    private function interview(int $applicationId, Carbon $at, string $status): void
    {
        $online = rand(1, 100) <= 30;
        DB::table('interviews')->insert([
            'application_id' => $applicationId, 'scheduled_at' => $at->copy()->utc()->toDateTimeString(),
            'mode' => $online ? 'online' : 'in_person',
            'location' => $online ? null : 'DSA Conference Room, 2nd Floor, Administration Building',
            'meeting_link' => $online ? 'https://meet.google.com/demo-swap-' . Str::lower(Str::random(3)) : null,
            'duration_minutes' => 30, 'status' => $status,
            'created_at' => $this->now, 'updated_at' => $this->now,
        ]);
    }

    /** A face-to-face-valid slot: a weekday in the next two weeks, 8:00 AM–4:00 PM Manila. */
    private function upcomingSlot(): Carbon
    {
        do {
            $day = now('Asia/Manila')->addDays(rand(1, 14));
        } while (!$day->isWeekday());

        return $day->setTime(rand(8, 15), [0, 30][rand(0, 1)]);
    }

    /** Sample files the seeded documents, notes and signatures point to. */
    private function sampleFiles(): array
    {
        $disk = Storage::disk(config('filesystems.documents_disk', 'public'));

        $pdf = Pdf::loadHTML('<div style="font-family: DejaVu Sans; padding: 60px; text-align: center">'
            . '<h2>SWAP Portal — Demo Document</h2><p>This file was generated by the DemoDataSeeder.<br>It stands in for an uploaded requirement.</p></div>')->output();
        $disk->put('demo/sample-document.pdf', $pdf);

        $disk->put('demo/sample-photo.png', $this->png(300, 300, function ($img) {
            $bg = imagecolorallocate($img, 220, 224, 207);
            $fg = imagecolorallocate($img, 31, 91, 58);
            imagefill($img, 0, 0, $bg);
            imagefilledellipse($img, 150, 115, 110, 120, $fg);
            imagefilledellipse($img, 150, 300, 230, 200, $fg);
        }));

        // A pen-like stroke on a transparent background, usable as a signature specimen.
        $disk->put('demo/signature.png', $this->png(360, 120, function ($img) {
            imagealphablending($img, false);
            imagesavealpha($img, true);
            imagefill($img, 0, 0, imagecolorallocatealpha($img, 255, 255, 255, 127));
            imagealphablending($img, true);
            $ink = imagecolorallocate($img, 20, 30, 90);
            imagesetthickness($img, 3);
            $px = 20; $py = 70;
            for ($x = 20; $x <= 340; $x += 4) {
                $y = (int) (70 + 28 * sin($x / 18) * cos($x / 53));
                imageline($img, $px, $py, $x, $y, $ink);
                [$px, $py] = [$x, $y];
            }
        }));

        return [
            'pdf' => 'demo/sample-document.pdf', 'pdf_size' => strlen($pdf),
            'png' => 'demo/sample-photo.png', 'png_size' => strlen($disk->get('demo/sample-photo.png')),
        ];
    }

    private function png(int $w, int $h, callable $draw): string
    {
        $img = imagecreatetruecolor($w, $h);
        $draw($img);
        ob_start();
        imagepng($img);
        imagedestroy($img);

        return (string) ob_get_clean();
    }

    /** Remove the previous run's accounts; their rows cascade (profiles, applications, placements, logs, stubs…). */
    private function wipePrevious(): void
    {
        $ids = DB::table('users')->where('email', 'like', '%@' . self::DOMAIN)->pluck('id');
        if ($ids->isEmpty()) {
            return;
        }
        DB::table('notifications')->where('notifiable_type', User::class)->whereIn('notifiable_id', $ids)->delete();
        DB::table('audit_logs')->where('auditable_type', User::class)->whereIn('auditable_id', $ids)->delete();
        DB::table('users')->whereIn('id', $ids)->delete();
        $this->command->line("  · removed {$ids->count()} accounts from the previous demo run");
    }
}
