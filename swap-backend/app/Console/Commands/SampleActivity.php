<?php

namespace App\Console\Commands;

use App\Models\Assignment;
use App\Models\Setting;
use App\Models\StudentProfile;
use App\Models\TimeLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Makes the imported recipients look like they have been using SWAP since the term began:
 * duty blocks fitted around their classes (mostly verified, the last week partly pending),
 * a daily narrative on each log, and profile details (birthdate, contact number, address).
 *
 * Everything added is recorded in the "sample_activity" setting, so --remove deletes exactly
 * those logs and puts the profile fields back. Recipients who already have time logs, the
 * kept accounts (ImportStudents::KEEP_EMAILS) and System Testing accounts are never touched.
 *
 *   php artisan swap:sample-activity --applicants=Applicant.csv --dry-run
 *   php artisan swap:sample-activity --remove
 */
class SampleActivity extends Command
{
    protected $signature = 'swap:sample-activity
        {--applicants= : Applicant.csv, to use the contact numbers it lists}
        {--remove : Delete the sample activity added earlier and restore the profiles}
        {--dry-run : Show what would happen and change nothing}
        {--force : Do not ask for confirmation}';

    protected $description = 'Give the imported recipients sample hours, daily narratives and profile details (removable with --remove)';

    public const TAG = 'sample_activity';
    private const TZ = 'Asia/Manila';
    private const PROFILE_FIELDS = ['date_of_birth', 'contact_number', 'address'];

    /** What each kind of office has its student assistants do (activities, plus a typical challenge). */
    private const WORK = [
        'registrar' => [
            ['Sorted and filed student records by college', 'Encoded grade sheets into the records system', 'Prepared request forms for transcripts and certifications', 'Assisted students at the request window', 'Checked student folders for missing documents'],
            ['Many requests came in at once during the morning', 'Some old folders were mislabeled and took time to find'],
        ],
        'library' => [
            ['Shelved returned books by call number', 'Assisted students in finding references', 'Encoded new acquisitions in the catalog', 'Checked borrowed books in and out at the circulation desk', 'Arranged the periodicals section'],
            ['Several books were misplaced on the wrong shelves', 'The circulation desk was busy during vacant periods'],
        ],
        'admission' => [
            ['Assisted applicants in filling out admission forms', 'Sorted and checked submitted admission requirements', 'Encoded applicant information', 'Answered walk-in inquiries about the admission schedule', 'Prepared the list of applicants for the entrance exam'],
            ['Many walk-in applicants came at the same time', 'Some applicants had incomplete requirements'],
        ],
        'scholarship' => [
            ['Sorted scholarship application forms', 'Encoded scholars\' grades for the semester', 'Prepared the list of scholars for stipend release', 'Answered inquiries about scholarship requirements', 'Filed scholarship documents'],
            ['Some scholars submitted incomplete documents', 'The list had to be rechecked against the latest grades'],
        ],
        'student affairs' => [
            ['Assisted students with inquiries at the front desk', 'Encoded student organization documents', 'Prepared materials for a student activity', 'Filed incoming communications', 'Helped arrange the office for a meeting'],
            ['There were many walk-in students in the afternoon', 'Some documents needed signatures from other offices'],
        ],
        'academic affairs' => [
            ['Received and logged incoming communications', 'Photocopied and distributed memos to the colleges', 'Encoded documents for the office records', 'Arranged files in the records cabinet', 'Assisted the staff with preparations for a meeting'],
            ['Some memos needed to be routed to several offices', 'The photocopier jammed a few times'],
        ],
        'college' => [
            ['Assisted the department secretary with paperwork', 'Encoded class lists and grade sheets', 'Photocopied and distributed handouts for faculty', 'Answered student inquiries at the dean\'s office', 'Organized files and records in the faculty room'],
            ['Faculty requests came in at the same time', 'Some class lists had to be corrected'],
        ],
        'general' => [
            ['Assisted the staff with clerical work', 'Encoded and filed office documents', 'Photocopied and sorted papers', 'Attended to visitors and inquiries', 'Helped keep the office clean and organized'],
            ['There were many tasks to finish within the day', 'Some files were hard to locate'],
        ],
    ];

    private const BARANGAYS = ['Sagonsongan', 'Basak Malutlut', 'Datu Naga', 'Lilod Saduc', 'Marinaut', 'Pagalamatan', 'Bangon', 'Cadayonan', 'Moncado Colony', 'Kapantaran', 'Tampilong', 'Panggao Saduc', 'Bubong Lilod', 'Rapasun MSU', 'Matampay', 'Dimaluna'];
    private const TOWNS = ['Marawi City', 'Marawi City', 'Marawi City', 'Marawi City', 'Saguiaran', 'Marantao', 'Bubong', 'Ditsaan-Ramain', 'Balindong', 'Piagapo', 'Tamparan'];

    /** @var array<string, string> email => contact number from Applicant.csv */
    private array $contacts = [];
    private array $stats = [];

    public function handle(): int
    {
        if ($this->option('remove')) {
            return $this->remove();
        }

        if (Setting::get(self::TAG)) {
            $this->error('Sample activity was already added. Run with --remove first to replace it.');
            return self::FAILURE;
        }

        $this->contacts = $this->readContacts($this->option('applicants'));
        $recipients = $this->recipients();
        if ($recipients->isEmpty()) {
            $this->warn('No imported recipients to fill.');
            return self::SUCCESS;
        }

        $dry = (bool) $this->option('dry-run');
        $this->line(sprintf('Database: %s (%s)  ·  %d recipients  ·  %s', DB::connection()->getDatabaseName(), DB::connection()->getDriverName(),
            $recipients->count(), $dry ? 'DRY RUN — nothing will be saved' : 'LIVE CHANGES'));

        if (!$dry && !$this->option('force') && !$this->confirm('Add sample hours, narratives and profile details?')) {
            return self::FAILURE;
        }

        DB::beginTransaction();
        try {
            $tag = $this->add($recipients);
            Setting::put(self::TAG, json_encode($tag));
            $dry ? DB::rollBack() : DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        $this->newLine();
        $this->info($dry ? 'Would do:' : 'Done:');
        foreach ($this->stats as $label => $n) {
            $this->line("  {$label}: {$n}");
        }
        $this->newLine();
        $this->line('Every sample record is tagged; remove it all with: php artisan swap:sample-activity --remove');

        return self::SUCCESS;
    }

    /** Imported recipients: not a kept account, not a System Testing account. */
    private function recipients()
    {
        return User::where('role', 'recipient')
            ->whereNotIn('email', ImportStudents::KEEP_EMAILS)
            ->whereNull('testing_added_at')
            ->with('profile')
            ->orderBy('id')
            ->get();
    }

    private function add($recipients): array
    {
        $ids = $recipients->pluck('id');
        $haveLogs = TimeLog::whereIn('user_id', $ids)->distinct()->pluck('user_id')->flip();
        $assignments = Assignment::with(['office', 'supervisor'])->whereIn('user_id', $ids)->current()->get()
            ->unique('user_id')->keyBy('user_id'); // newest active placement per student

        $today = Carbon::now(self::TZ)->startOfDay();
        $stamp = now()->startOfSecond();
        $profiles = [];
        $rows = [];
        $narratives = [];

        foreach ($recipients as $user) {
            mt_srand(crc32($user->email));

            if ($user->profile && ($original = $this->fillProfile($user->profile, $user->email))) {
                $profiles[$user->id] = $original;
            }

            $assignment = $assignments->get($user->id);
            if (!$assignment || $haveLogs->has($user->id)) {
                $this->bump($assignment ? 'skipped (already has time logs)' : 'recipients without an office (profile only)');
                continue;
            }

            foreach ($this->shifts($assignment, $today) as $shift) {
                $rows[] = $this->logRow($assignment, $shift, $today, $stamp);
                $narratives[] = $this->narrative($assignment->office?->name ?? '');
            }
            $this->bump('recipients given hours');
        }

        $lastId = (int) TimeLog::max('id');
        foreach (array_chunk($rows, 300) as $chunk) {
            DB::table('time_logs')->insert($chunk);
        }

        // The new logs, in insert order, to attach each one's narrative.
        $logs = TimeLog::where('id', '>', $lastId)->whereIn('user_id', $ids)->where('created_at', $stamp)->orderBy('id')->get(['id', 'time_out']);
        if ($logs->count() !== count($narratives)) {
            throw new \RuntimeException('Inserted logs do not match the generated ones; nothing was saved.');
        }
        $narrativeRows = $logs->values()->map(fn ($log, $i) => $narratives[$i] + [
            'time_log_id' => $log->id,
            'submitted_at' => $log->time_out->copy()->addMinutes(mt_rand(2, 40)),
            'created_at' => $stamp,
            'updated_at' => $stamp,
        ])->all();
        foreach (array_chunk($narrativeRows, 300) as $chunk) {
            DB::table('narrative_reports')->insert($chunk);
        }

        $this->stats['time logs added'] = $logs->count();
        $this->stats['verified hours'] = round((float) TimeLog::whereIn('id', $logs->pluck('id'))->where('status', 'verified')->sum('duration_hours'), 1);
        $this->stats['logs waiting for the supervisor'] = TimeLog::whereIn('id', $logs->pluck('id'))->where('status', 'pending_verification')->count();
        $perStudent = TimeLog::whereIn('id', $logs->pluck('id'))->groupBy('user_id')
            ->selectRaw('sum(duration_hours) as h')->pluck('h')->map(fn ($h) => (float) $h)->sort()->values();
        if ($perStudent->isNotEmpty()) {
            $this->stats['hours per student (lowest / middle / highest)'] = sprintf('%.0f / %.0f / %.0f',
                $perStudent->first(), $perStudent[intdiv($perStudent->count(), 2)], $perStudent->last());
            foreach ([[0, 30], [30, 60], [60, 90], [90, 120], [120, 999]] as [$lo, $hi]) {
                $label = $hi === 999 ? "{$lo}+ h" : "{$lo}–{$hi} h";
                $this->stats["  students with {$label}"] = $perStudent->filter(fn ($h) => $h >= $lo && $h < $hi)->count();
            }
        }
        $this->stats['daily narratives added'] = count($narrativeRows);
        $this->stats['profiles filled in'] = count($profiles);

        return ['added_at' => $stamp->toIso8601String(), 'log_ids' => $logs->pluck('id')->all(), 'profiles' => $profiles];
    }

    /**
     * The student's duty this term, fitted around classes. Each student has their own free
     * weekdays (2–5 a week) and a duty style:
     *  - split: a short block in the morning and another in the afternoon (1–2 h each, sometimes just one);
     *  - single: one 1–3 h block when they have a vacant period;
     *  - long: a 3–6 h stretch on days without classes.
     * Most come on most of their free days; a few miss many (behind on hours).
     *
     * @return list<array{in: Carbon, hours: float}>
     */
    private function shifts(Assignment $assignment, Carbon $today): array
    {
        $start = Carbon::parse(Carbon::parse($assignment->start_date)->toDateString(), self::TZ);
        $cap = (float) $assignment->required_hours - 10;

        $style = match (true) {
            ($r = mt_rand(1, 100)) <= 40 => 'split',
            $r <= 75 => 'single',
            default => 'long',
        };
        $freeDays = (array) array_rand(array_flip([1, 2, 3, 4, 5]), mt_rand(2, 5)); // ISO weekdays
        $turnout = mt_rand(1, 100) <= 15 ? mt_rand(35, 55) : mt_rand(75, 95);       // % of free days they come
        $half = fn (float $min, float $max) => mt_rand((int) ($min * 2), (int) ($max * 2)) / 2;

        $shifts = [];
        $total = 0.0;
        for ($d = $start->copy(); $d->lt($today) && $total < $cap; $d->addDay()) {
            if (!in_array($d->dayOfWeekIso, $freeDays, true) || mt_rand(1, 100) > $turnout) {
                continue;
            }
            $blocks = match ($style) {
                'split' => array_values(array_filter([
                    mt_rand(1, 100) <= 85 ? [$d->copy()->setTime(7, 30)->addMinutes(mt_rand(0, 6) * 15), $half(1, 2)] : null,
                    mt_rand(1, 100) <= 85 ? [$d->copy()->setTime(13, 0)->addMinutes(mt_rand(0, 8) * 15), $half(1, 2)] : null,
                ])),
                'single' => [mt_rand(0, 1)
                    ? [$d->copy()->setTime(8, 0)->addMinutes(mt_rand(0, 8) * 15), $half(1, 3)]
                    : [$d->copy()->setTime(13, 0)->addMinutes(mt_rand(0, 8) * 15), $half(1, 3)]],
                default => [($h = $half(3, 6)) <= 4 && mt_rand(0, 1)
                    ? [$d->copy()->setTime(13, 0)->addMinutes(mt_rand(0, 2) * 15), $h]
                    : [$d->copy()->setTime(8, 0)->addMinutes(mt_rand(0, 4) * 15), $h]],
            };
            foreach ($blocks as [$in, $hours]) {
                $hours = min($hours, max(1.0, $cap - $total));
                $shifts[] = ['in' => $in, 'hours' => $hours];
                $total += $hours;
            }
        }

        return $shifts;
    }

    private function logRow(Assignment $assignment, array $shift, Carbon $today, Carbon $stamp): array
    {
        /** @var Carbon $in */
        $in = $shift['in']->copy()->addMinutes(mt_rand(0, 9));
        $day = $in->copy()->startOfDay();
        $hours = $shift['hours'];
        $out = $in->copy()->addMinutes((int) round($hours * 60) + mt_rand(0, 8));

        // The last week is partly still waiting for the supervisor; a rare older log was rejected.
        $recent = $day->gte($today->copy()->subDays(7));
        $status = match (true) {
            $recent && mt_rand(1, 10) <= 6 => 'pending_verification',
            !$recent && mt_rand(1, 100) <= 3 => 'rejected',
            default => 'verified',
        };
        $reviewedAt = $status === 'pending_verification' ? null
            : Carbon::createFromTimestamp(min(now()->timestamp, $out->copy()->addHours(mt_rand(1, 48))->timestamp));

        $office = $assignment->office;
        $jitter = fn () => mt_rand(-150, 150) / 1_000_000;
        $hasPin = $office && $office->latitude !== null && $office->longitude !== null;

        return [
            'assignment_id' => $assignment->id,
            'user_id' => $assignment->user_id,
            'date' => $day->toDateString(),
            'time_in' => $in->copy()->utc(),
            'time_out' => $out->copy()->utc(),
            'status' => $status,
            'verified_by' => $status === 'pending_verification' ? null : $assignment->supervisor_id,
            'verified_at' => $reviewedAt?->utc(),
            'rejection_reason' => $status === 'rejected' ? 'Time-out does not match the office logbook. Please see me.' : null,
            'clocked_out_reason' => 'manual',
            'time_in_lat' => $hasPin ? (float) $office->latitude + $jitter() : null,
            'time_in_lng' => $hasPin ? (float) $office->longitude + $jitter() : null,
            'time_out_lat' => $hasPin ? (float) $office->latitude + $jitter() : null,
            'time_out_lng' => $hasPin ? (float) $office->longitude + $jitter() : null,
            'time_in_accuracy' => $hasPin ? mt_rand(500, 2500) / 100 : null,
            'time_out_accuracy' => $hasPin ? mt_rand(500, 2500) / 100 : null,
            'location_flagged' => false,
            'is_manual' => false,
            'created_at' => $stamp,
            'updated_at' => $stamp,
        ];
    }

    /** @return array{content: string, activities_done: string, challenges: ?string} */
    private function narrative(string $officeName): array
    {
        [$tasks, $challenges] = self::WORK[$this->workKind($officeName)];
        $done = (array) array_rand(array_flip($tasks), mt_rand(2, 3));
        $place = $officeName !== '' ? "the {$officeName}" : 'the office';

        return [
            'content' => sprintf('Reported to %s and %s. %s.', $place, lcfirst($done[0]), $done[1]),
            'activities_done' => implode("\n", array_map(fn ($t) => "- {$t}", $done)),
            'challenges' => mt_rand(1, 10) <= 3 ? $challenges[array_rand($challenges)] . '.' : null,
        ];
    }

    private function workKind(string $office): string
    {
        $o = strtolower($office);
        return match (true) {
            str_contains($o, 'registrar') => 'registrar',
            str_contains($o, 'library') => 'library',
            str_contains($o, 'admission') => 'admission',
            str_contains($o, 'scholarship') => 'scholarship',
            str_contains($o, 'student affairs') => 'student affairs',
            str_contains($o, 'academic affairs') => 'academic affairs',
            str_contains($o, 'college') || str_contains($o, 'division of') => 'college',
            default => 'general',
        };
    }

    /**
     * Fills the empty profile fields only. Returns their original values (for --remove),
     * or null when nothing was empty.
     */
    private function fillProfile(StudentProfile $profile, string $email): ?array
    {
        $original = array_intersect_key($profile->getAttributes(), array_flip(self::PROFILE_FIELDS));
        $year = (int) ($profile->year_level ?: mt_rand(1, 4));
        $values = [
            // About 18 in 1st year, 21 in 4th year, as of this school year.
            'date_of_birth' => Carbon::create(2026 - 17 - $year, mt_rand(1, 12), mt_rand(1, 28))->toDateString(),
            'contact_number' => $this->contacts[strtolower($email)]
                // 0900 is not a carrier prefix, so a made-up number can't reach a real person.
                ?? sprintf('0900 %03d %04d', mt_rand(0, 999), mt_rand(0, 9999)),
            'address' => sprintf('Brgy. %s, %s, Lanao del Sur', self::BARANGAYS[array_rand(self::BARANGAYS)], self::TOWNS[array_rand(self::TOWNS)]),
        ];
        $fill = array_filter($values, fn ($v, $field) => blank($original[$field] ?? null), ARRAY_FILTER_USE_BOTH);
        if (!$fill) {
            return null;
        }
        $profile->forceFill($fill)->save();

        return array_intersect_key($original, $fill);
    }

    private function remove(): int
    {
        $tag = json_decode((string) Setting::get(self::TAG), true);
        if (!$tag) {
            $this->warn('There is no sample activity to remove.');
            return self::SUCCESS;
        }

        $dry = (bool) $this->option('dry-run');
        $logIds = $tag['log_ids'] ?? [];
        $profiles = $tag['profiles'] ?? [];
        $this->line(sprintf('Sample activity added %s: %d time logs, %d profiles.%s', $tag['added_at'] ?? '?', count($logIds), count($profiles), $dry ? '  DRY RUN' : ''));
        if (!$dry && !$this->option('force') && !$this->confirm('Remove it?')) {
            return self::FAILURE;
        }

        DB::beginTransaction();
        try {
            $deleted = 0;
            foreach (array_chunk($logIds, 500) as $chunk) {
                DB::table('narrative_reports')->whereIn('time_log_id', $chunk)->delete();
                DB::table('verifications')->whereIn('time_log_id', $chunk)->delete();
                $deleted += DB::table('time_logs')->whereIn('id', $chunk)->delete();
            }
            foreach ($profiles as $userId => $original) {
                StudentProfile::where('user_id', $userId)->update($original);
            }
            Setting::query()->where('key', self::TAG)->delete();
            $dry ? DB::rollBack() : DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        $this->info(($dry ? 'Would remove' : 'Removed') . " {$deleted} time logs and restored " . count($profiles) . ' profiles.');

        return self::SUCCESS;
    }

    /** @return array<string, string> */
    private function readContacts(?string $path): array
    {
        if (!$path) {
            return [];
        }
        if (!is_file($path)) {
            throw new \InvalidArgumentException("File not found: {$path}");
        }
        $fh = fopen($path, 'r');
        $head = array_map(fn ($h) => trim(preg_replace('/^\xEF\xBB\xBF/', '', $h)), fgetcsv($fh) ?: []);
        $out = [];
        while (($cells = fgetcsv($fh)) !== false) {
            $row = array_combine($head, array_pad($cells, count($head), ''));
            $email = strtolower(trim($row['Institutional_Email'] ?? ''));
            $phone = trim($row['Contact_Number'] ?? '');
            if ($email !== '' && $phone !== '') {
                $out[$email] = $phone;
            }
        }
        fclose($fh);

        return $out;
    }

    private function bump(string $label): void
    {
        $this->stats[$label] = ($this->stats[$label] ?? 0) + 1;
    }
}
