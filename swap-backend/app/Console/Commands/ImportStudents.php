<?php

namespace App\Console\Commands;

use App\Http\Requests\Auth\RegisterRequest;
use App\Models\Application;
use App\Models\ApplicationDocument;
use App\Models\Assignment;
use App\Models\Office;
use App\Models\SemesterPeriod;
use App\Models\Setting;
use App\Models\StudentProfile;
use App\Models\User;
use App\Services\QrCodeService;
use App\Services\SemesterPeriodService;
use App\Support\Colleges;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Replace the dummy accounts with the DSA's real student lists (Recipient.csv / Applicant.csv).
 *
 *  1. Keeps every admin, the --keep emails and the supervisor "Prof. Haddy"; permanently deletes
 *     everyone else with their records (placements, hours, applications, stipends…).
 *  2. Creates each recipient (password Student@123, verified). Highlighted rows get an approved
 *     application and no office yet (Admin → Assignments → to assign); the others are placed for the
 *     current semester in a random active office with room; an office with no supervisor gets one
 *     (password Supervisor@123, logins written to storage/app/import/supervisors.csv).
 *  3. Creates each applicant not already in the recipient list, with a submitted application
 *     (Admin → Applications). Imported applications' documents are "not submitted" placeholders.
 *  An email or student ID that already exists is never replaced. Nothing is emailed or notified.
 *  4. Turns the sign-in code off (System Testing → Sign-in code), so the accounts open with the password.
 *
 * --dry-run does all of it inside a transaction and rolls it back, printing the same summary.
 */
class ImportStudents extends Command
{
    protected $signature = 'swap:import-students
        {--recipients= : Path to Recipient.csv}
        {--applicants= : Path to Applicant.csv}
        {--keep=* : Extra emails to keep}
        {--dry-run : Show what would happen and change nothing}
        {--force : Do not ask for confirmation}';

    protected $description = 'Replace dummy accounts with the real recipient and applicant lists';

    public const STUDENT_PASSWORD = 'Student@123';
    public const SUPERVISOR_PASSWORD = 'Supervisor@123';
    public const KEEP_EMAILS = ['norodin.nm262@s.msumain.edu.ph', 'mamalampac.ja575@s.msumain.edu.ph'];
    private const REQUIRED_HOURS = 200;

    /** @var array<string, int> */
    private array $counts = [];
    /** @var list<string> */
    private array $warnings = [];
    /** @var list<array{office: string, name: string, email: string, password: string}> */
    private array $newSupervisors = [];
    /** @var array<string, int> */
    private array $placed = [];

    public function handle(QrCodeService $qr, SemesterPeriodService $periods): int
    {
        $recipients = $this->readCsv($this->option('recipients'), 'recipients');
        $applicants = $this->readCsv($this->option('applicants'), 'applicants');
        if ($recipients === null || $applicants === null) {
            return self::FAILURE;
        }

        $period = $periods->current() ?? SemesterPeriod::orderByDesc('start_date')->first();
        if (!$period) {
            $this->error('No semester period exists. Add one on Admin → Semesters first.');
            return self::FAILURE;
        }

        $dry = (bool) $this->option('dry-run');
        $this->line(sprintf('Database: <info>%s</info> (%s)  ·  Term: <info>%s %s</info>  ·  %s',
            DB::connection()->getDatabaseName(), config('database.default'), $period->semester, $period->academic_year,
            $dry ? '<comment>DRY RUN — nothing will be saved</comment>' : '<comment>LIVE CHANGES</comment>'));

        [$keep, $delete] = $this->partition();
        $this->info("\nKept accounts (" . $keep->count() . '):');
        foreach ($keep as $u) {
            $this->line("  · {$u->name} <{$u->email}> [{$u->role}]");
        }
        $this->line("\nAccounts to delete permanently: " . $delete->count()
            . ' (' . $delete->countBy('role')->map(fn ($n, $r) => "{$n} {$r}")->join(', ') . ')');

        if (!$dry && !$this->option('force') && !$this->confirm('Delete those accounts and import the lists?')) {
            $this->warn('Cancelled.');
            return self::FAILURE;
        }

        DB::beginTransaction();
        try {
            $this->import($keep, $delete, $recipients, $applicants, $period, $qr);
            $dry ? DB::rollBack() : DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error('Nothing was changed: ' . $e->getMessage());
            return self::FAILURE;
        }

        if (!$dry) {
            Setting::put('login_otp_enabled', '0');
            $this->writeSupervisorFile();
        }

        $this->report($dry);

        return self::SUCCESS;
    }

    // ── Steps ──────────────────────────────────────────────────────────────

    private function import(Collection $keep, Collection $delete, array $recipients, array $applicants, SemesterPeriod $period, QrCodeService $qr): void
    {
        $deleteIds = $delete->pluck('id')->all();

        // Offices in use by kept students whose supervisor is being deleted need a supervisor first.
        $orphaned = Assignment::whereIn('user_id', $keep->pluck('id'))->whereIn('supervisor_id', $deleteIds)->get();
        foreach ($orphaned as $a) {
            $a->forceFill(['supervisor_id' => $this->supervisorFor($a->office, $deleteIds)->id])->save();
        }

        $this->deleteUsers($delete);

        // Recipients.
        $recipientKeys = [];
        foreach ($recipients as $row) {
            $email = $this->email($row);
            $id = $this->studentId($row);
            $recipientKeys[$email] = true;
            if ($id) {
                $recipientKeys["id:{$id}"] = true;
            }
            if ($why = $this->exists($email, $id)) {
                $this->skip("recipient {$this->fullName($row)}: {$why}");
                continue;
            }
            $user = $this->createStudent($row, 'recipient');

            // Highlighted on the DSA list: approved, still waiting for an office (Assignments → to assign).
            if (strcasecmp($this->clean($row['Highlighted'] ?? ''), 'yes') === 0) {
                $this->createApplication($user, $period, 'approved');
                $this->bump('recipients waiting for an office (highlighted)');
                continue;
            }

            $office = $this->pickOffice();
            if (!$office) {
                $this->warnings[] = "No active office with room for {$user->name}; not placed.";
                continue;
            }
            $assignment = Assignment::create([
                'user_id' => $user->id,
                'office_id' => $office->id,
                'supervisor_id' => $this->supervisorFor($office, [])->id,
                'academic_year' => $period->academic_year,
                'semester' => $period->semester,
                'required_hours' => self::REQUIRED_HOURS,
                'start_date' => $period->start_date?->toDateString() ?? now()->toDateString(),
                'status' => 'active',
            ]);
            $qr->generateForAssignment($assignment);
            $this->placed[$office->name] = ($this->placed[$office->name] ?? 0) + 1;
            $this->bump('recipients placed in an office');
        }

        // Applicants: those already in the recipient list are recipients, not applicants.
        foreach ($applicants as $row) {
            $email = $this->email($row);
            $id = $this->studentId($row);
            if (isset($recipientKeys[$email]) || ($id && isset($recipientKeys["id:{$id}"]))) {
                $this->bump('applicants skipped (in the recipient list)');
                continue;
            }
            if ($why = $this->exists($email, $id)) {
                $this->skip("applicant {$this->fullName($row)}: {$why}");
                continue;
            }
            $this->createApplication($this->createStudent($row, 'applicant'), $period, 'submitted');
            $this->bump('applicants created (application submitted)');
        }
    }

    /**
     * A new application for the term, with the four requirements pointing at the bundled
     * "not submitted" placeholders (ApplicationDocument::PLACEHOLDER_*), so the review page opens them.
     */
    private function createApplication(User $user, SemesterPeriod $period, string $status): void
    {
        $approved = $status === 'approved';
        $application = Application::create([
            'user_id' => $user->id,
            'academic_year' => $period->academic_year,
            'semester' => $period->semester,
            'type' => 'new',
            'status' => $status,
            'remarks' => $approved ? 'Imported from the DSA recipient list.' : null,
            'reviewed_by' => $approved ? $this->adminId() : null,
            'reviewed_at' => $approved ? now() : null,
        ]);

        $docs = [
            'cor' => ['COR (not submitted).pdf', ApplicationDocument::PLACEHOLDER_PDF, 'application/pdf'],
            'grades' => ['Grades (not submitted).pdf', ApplicationDocument::PLACEHOLDER_PDF, 'application/pdf'],
            'letter_of_intent' => ['Letter of intent (not submitted).pdf', ApplicationDocument::PLACEHOLDER_PDF, 'application/pdf'],
            'id_photo' => ['2x2 photo (not submitted).png', ApplicationDocument::PLACEHOLDER_PHOTO, 'image/png'],
        ];
        foreach ($docs as $type => [$name, $path, $mime]) {
            ApplicationDocument::create([
                'application_id' => $application->id,
                'document_type' => $type,
                'file_path' => $path,
                'file_url' => $path,
                'file_name' => $name,
                'file_size' => @filesize(resource_path('placeholders/' . basename($path))) ?: null,
                'mime_type' => $mime,
            ]);
        }
    }

    private ?int $adminId = null;

    private function adminId(): ?int
    {
        return $this->adminId ??= User::where('role', 'admin')->orderBy('id')->value('id');
    }

    /** Keep: admins, the keep emails, and the supervisor Prof. Haddy. Delete: everyone else (incl. soft-deleted). */
    private function partition(): array
    {
        $keepEmails = collect([...self::KEEP_EMAILS, ...$this->option('keep')])->map(fn ($e) => mb_strtolower(trim($e)))->all();
        $all = User::withTrashed()->orderBy('id')->get(['id', 'name', 'email', 'role', 'office_id']);
        $isHaddy = fn (User $u) => $u->role === 'supervisor'
            && preg_replace('/[^a-z]/', '', mb_strtolower($u->name)) === 'profhaddy';
        $keep = $all->filter(fn (User $u) => $u->role === 'admin' || in_array(mb_strtolower($u->email), $keepEmails, true) || $isHaddy($u));

        return [$keep->values(), $all->diffKeys($keep)->values()];
    }

    /** Students first (their records cascade), then staff; bells and tokens have no foreign key. */
    private function deleteUsers(Collection $delete): void
    {
        $ids = $delete->pluck('id');
        $students = $delete->whereIn('role', ['applicant', 'recipient'])->pluck('id');
        $staff = $ids->diff($students);

        foreach ([$students, $staff] as $set) {
            foreach ($set->chunk(200) as $chunk) {
                DB::table('notifications')->where('notifiable_type', User::class)->whereIn('notifiable_id', $chunk)->delete();
                DB::table('personal_access_tokens')->where('tokenable_type', User::class)->whereIn('tokenable_id', $chunk)->delete();
                // Placements they supervise belong to deleted students by now; any left are another
                // deleted supervisor's leftovers and go with them.
                DB::table('assignments')->whereIn('supervisor_id', $chunk)->whereIn('user_id', $ids)->delete();
                DB::table('users')->whereIn('id', $chunk)->delete();
            }
        }
        $this->counts['accounts deleted'] = $ids->count();
    }

    private function createStudent(array $row, string $role): User
    {
        $first = $this->clean($row['First_Name'] ?? '');
        $middle = $this->clean($row['Middle_Initial'] ?? '');
        $last = $this->clean($row['Last_Name'] ?? '');
        $user = User::create([
            'name' => RegisterRequest::fullName($first, $middle ?: null, $last) ?? $this->clean($row['Full_Name'] ?? ''),
            'email' => $this->email($row),
            'password' => self::STUDENT_PASSWORD,
            'role' => $role,
            'is_active' => true,
            'email_verified_at' => now(),
        ]);
        StudentProfile::create([
            'user_id' => $user->id,
            'student_id_number' => $this->studentId($row),
            'first_name' => $first,
            'middle_name' => $middle ?: null,
            'last_name' => $last,
            'contact_number' => $this->clean($row['Contact_Number'] ?? '') ?: null,
            'college' => $this->college($row) ?? '',
            'program' => $this->clean($row['Course'] ?? ''),
            'year_level' => (int) preg_replace('/\D.*/', '', $this->clean($row['Year_Level'] ?? '')) ?: null,
        ]);

        return $user;
    }

    /** A random active office that still has room. */
    private function pickOffice(): ?Office
    {
        $open = Office::where('is_active', true)->withCount('activeAssignments')->get()
            ->filter(fn (Office $o) => $o->active_assignments_count < (int) $o->max_recipients);

        return $open->isEmpty() ? null : $open->random();
    }

    /** The office's first kept supervisor, or a new one (password Supervisor@123). */
    private function supervisorFor(Office $office, array $excludeIds): User
    {
        $existing = User::where('role', 'supervisor')->where('office_id', $office->id)
            ->whereNotIn('id', $excludeIds)->orderBy('id')->first();
        if ($existing) {
            return $existing;
        }

        $handle = $this->handleFor($office->name);
        $email = "{$handle}.supervisor@swap.test";
        $n = 2;
        while (User::withTrashed()->where('email', $email)->exists()) {
            $email = "{$handle}{$n}.supervisor@swap.test";
            $n++;
        }
        $user = User::create([
            'name' => "{$office->name} Supervisor",
            'email' => $email,
            'password' => self::SUPERVISOR_PASSWORD,
            'role' => 'supervisor',
            'is_active' => true,
            'office_id' => $office->id,
            'email_verified_at' => now(),
        ]);
        $this->newSupervisors[] = ['office' => $office->name, 'name' => $user->name, 'email' => $email, 'password' => self::SUPERVISOR_PASSWORD];

        return $user;
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    /** Short login handle: the college code (coa), initials for long names (dsa, ovcaa), else a slug (university-library). */
    private function handleFor(string $officeName): string
    {
        foreach (config('colleges') as $code => $college) {
            if (strcasecmp($college['label'] ?? '', $officeName) === 0) {
                return Str::lower($code);
            }
        }
        $words = array_values(array_filter(preg_split('/[\s,.]+/', $officeName),
            fn ($w) => $w !== '' && !in_array(Str::lower($w), ['of', 'the', 'and', 'for', 'office'], true)));
        if (count($words) > 3) {
            return Str::lower(implode('', array_map(fn ($w) => $w[0], $words)));
        }

        return Str::slug(implode(' ', $words)) ?: 'office';
    }

    private function readCsv(?string $path, string $label): ?array
    {
        if (!$path || !is_readable($path)) {
            $this->error("Give --{$label}=<path to the CSV> (not found: " . ($path ?: 'none') . ').');
            return null;
        }
        $fh = fopen($path, 'r');
        $header = array_map(fn ($h) => trim(preg_replace('/^\xEF\xBB\xBF/', '', (string) $h)), fgetcsv($fh) ?: []);
        $rows = [];
        while (($cols = fgetcsv($fh)) !== false) {
            if (count(array_filter($cols, fn ($c) => trim((string) $c) !== '')) === 0) {
                continue;
            }
            $rows[] = array_combine($header, array_pad(array_slice($cols, 0, count($header)), count($header), ''));
        }
        fclose($fh);
        foreach (['ID_Number', 'Last_Name', 'First_Name', 'Institutional_Email'] as $col) {
            if (!in_array($col, $header, true)) {
                $this->error("{$label}: missing column {$col}.");
                return null;
            }
        }

        return $rows;
    }

    private function exists(string $email, ?string $id): ?string
    {
        if (User::withTrashed()->whereRaw('LOWER(email) = ?', [$email])->exists()) {
            return 'email already has an account (kept as is)';
        }
        if ($id && StudentProfile::withTrashed()->where('student_id_number', $id)->exists()) {
            return 'student ID already has an account (kept as is)';
        }

        return null;
    }

    private function college(array $row): ?string
    {
        $raw = strtoupper($this->clean($row['College'] ?? ''));
        if ($raw === '') {
            $this->warnings[] = "{$this->fullName($row)}: no college on the sheet.";
            return null;
        }
        $aliases = ['COE-DET' => 'DET'];
        $raw = $aliases[$raw] ?? $raw;
        foreach (Colleges::codes() as $code) {
            if (strtoupper($code) === $raw) {
                return $code;
            }
        }
        $this->warnings[] = "{$this->fullName($row)}: unknown college \"{$raw}\" kept as written.";

        return $raw;
    }

    private function email(array $row): string
    {
        return mb_strtolower($this->clean($row['Institutional_Email'] ?? ''));
    }

    private function studentId(array $row): ?string
    {
        $id = preg_replace('/\D/', '', (string) ($row['ID_Number'] ?? ''));

        return $id !== '' ? $id : null;
    }

    private function fullName(array $row): string
    {
        return $this->clean($row['Full_Name'] ?? '') ?: trim(($row['First_Name'] ?? '') . ' ' . ($row['Last_Name'] ?? ''));
    }

    private function clean(string $v): string
    {
        return trim(preg_replace('/\s+/u', ' ', $v));
    }

    private function bump(string $key): void
    {
        $this->counts[$key] = ($this->counts[$key] ?? 0) + 1;
    }

    private function skip(string $why): void
    {
        $this->bump('skipped (already exist)');
        $this->line("  skip: {$why}");
    }

    private function writeSupervisorFile(): void
    {
        if (!$this->newSupervisors) {
            return;
        }
        $csv = "office,name,email,password\n" . collect($this->newSupervisors)
            ->map(fn ($s) => collect($s)->map(fn ($v) => '"' . str_replace('"', '""', $v) . '"')->join(','))->join("\n") . "\n";
        Storage::disk('local')->put('import/supervisors.csv', $csv);
        $this->line('Supervisor logins saved to ' . Storage::disk('local')->path('import/supervisors.csv'));
    }

    private function report(bool $dry): void
    {
        $this->info("\n" . ($dry ? 'Would do' : 'Done') . ':');
        foreach ($this->counts as $k => $n) {
            $this->line("  {$k}: {$n}");
        }
        if ($this->placed) {
            $this->info("\nPlacements per office:");
            ksort($this->placed);
            foreach ($this->placed as $office => $n) {
                $this->line("  {$office}: {$n}");
            }
        }
        if ($this->newSupervisors) {
            $this->info("\nNew supervisors (password " . self::SUPERVISOR_PASSWORD . '):');
            foreach ($this->newSupervisors as $s) {
                $this->line("  {$s['office']}: {$s['email']}");
            }
        }
        if ($this->warnings) {
            $this->warn("\nCheck these:");
            foreach (array_unique($this->warnings) as $w) {
                $this->line("  · {$w}");
            }
        }
        $this->line("\nStudents sign in with " . self::STUDENT_PASSWORD . '. '
            . ($dry ? 'The sign-in code would be switched off.' : 'The sign-in code is now OFF (turn it back on in System Testing → Sign-in code).'));
    }
}
