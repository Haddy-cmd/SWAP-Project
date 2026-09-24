<?php

namespace Database\Seeders;

/**
 * TEST-ONLY demo data for the stipend features (eligible checklist + promissory
 * workflow). NOT registered in DatabaseSeeder, so it can never run on deploy.
 * Safe to re-run: existing demo emails are skipped, never duplicated.
 *
 * DELETE LATER (before go-live) — everything is keyed off @test.swap:
 *   1. php artisan tinker
 *   2. $ids = App\Models\User::where('email', 'like', '%@test.swap')->pluck('id');
 *      App\Models\TimeLog::whereIn('user_id', $ids)->delete();
 *      App\Models\PromissoryNote::whereIn('user_id', $ids)->delete();
 *      App\Models\Assignment::whereIn('user_id', $ids)->delete();
 *      App\Models\User::whereIn('id', $ids)->forceDelete();
 *   3. Delete this file.
 * Demo files live under storage/app/public/promissory/{assignmentId}/ — remove
 * those folders too (paths are printed below on every run).
 */

use App\Models\Assignment;
use App\Models\Office;
use App\Models\TimeLog;
use App\Models\User;
use App\Services\PromissoryService;
use Illuminate\Database\Seeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

class StipendDemoSeeder extends Seeder
{
    private const DOMAIN = '@test.swap';
    private const PASSWORD = 'Student@12345';

    public function run(): void
    {
        $supervisor = User::where('role', 'supervisor')->first();
        $office = Office::where('is_active', true)->first();

        if (!$supervisor || !$office) {
            $this->command->error('Need at least one supervisor and one active office in the dev DB first.');

            return;
        }

        // ── 3 eligible students (verified ≥ required) ─────────────────────────
        foreach ([1, 2, 3] as $n) {
            $user = $this->demoUser("Demo Eligible {$n}", "eligible{$n}".self::DOMAIN);
            if (!$user) {
                continue;
            }

            $assignment = Assignment::create([
                'user_id' => $user->id,
                'office_id' => $office->id,
                'supervisor_id' => $supervisor->id,
                'academic_year' => '2025-2026',
                'semester' => '1st Semester',
                'required_hours' => 8,
                'start_date' => Carbon::now('Asia/Manila')->subMonth()->toDateString(),
                'status' => 'active',
            ]);

            // Two 4h verified logs on recent weekdays (duration is auto-computed).
            foreach ($this->recentWeekdays(2) as $day) {
                TimeLog::create([
                    'assignment_id' => $assignment->id,
                    'user_id' => $user->id,
                    'date' => $day->toDateString(),
                    'time_in' => $day->copy()->setTime(8, 0),
                    'time_out' => $day->copy()->setTime(12, 0),
                    'status' => 'verified',
                ]);
            }

            $this->command->info("Eligible: {$user->name} <{$user->email}> — 8/8h verified, in the release checklist.");
        }

        // ── Promissory cases (semester ended yesterday, required 200) ─────────
        $this->promissoryCase($supervisor, $office, 'Demo Promissory Pending', 'promissory-pending'.self::DOMAIN, false);
        $this->promissoryCase($supervisor, $office, 'Demo Promissory Approved', 'promissory-approved'.self::DOMAIN, true);
        $this->promissoryCase($supervisor, $office, 'Demo Promissory Short', 'promissory-short'.self::DOMAIN, null);
    }

    /**
     * @param bool|null $review null = no note (control case), false = leave pending, true = approve
     */
    private function promissoryCase(User $supervisor, Office $office, string $name, string $email, ?bool $review): void
    {
        $user = $this->demoUser($name, $email);
        if (!$user) {
            return;
        }

        $assignment = Assignment::create([
            'user_id' => $user->id,
            'office_id' => $office->id,
            'supervisor_id' => $supervisor->id,
            'academic_year' => '2025-2026',
            'semester' => '1st Semester',
            'required_hours' => 200,
            'start_date' => Carbon::now('Asia/Manila')->subMonths(5)->toDateString(),
            'end_date' => Carbon::now('Asia/Manila')->subDay()->toDateString(),
            'status' => 'active',
        ]);

        // One 4h verified log: short (4/200) but realistic.
        $day = $this->recentWeekdays(1)[0];
        TimeLog::create([
            'assignment_id' => $assignment->id,
            'user_id' => $user->id,
            'date' => $day->toDateString(),
            'time_in' => $day->copy()->setTime(8, 0),
            'time_out' => $day->copy()->setTime(12, 0),
            'status' => 'verified',
        ]);

        if ($review === null) {
            $this->command->info("Control: {$name} <{$email}> — short, no note (invisible everywhere).");

            return;
        }

        $service = app(PromissoryService::class);
        $note = $service->submit($user, [
            'assignment_id' => $assignment->id,
            'reason' => 'Demo data: fell short during exam weeks, will render the lacking hours ASAP.',
        ], $this->demoPdf());

        if ($review) {
            $service->review($supervisor, $note, ['action' => 'approve', 'lacking_hours' => 196]);
            $this->command->info("Approved: {$name} <{$email}> — in eligible list WITH promissory badge.");
        } else {
            $this->command->info("Pending: {$name} <{$email}> — in the supervisor promissory queue.");
        }
        $this->command->info("  file: storage/app/public/promissory/{$assignment->id}/");
    }

    /** Find-or-create a demo user; null when it already existed (idempotent reruns). */
    private function demoUser(string $name, string $email): ?User
    {
        if (User::where('email', $email)->exists()) {
            $this->command->warn("Skipping {$email} — already seeded.");

            return null;
        }

        return User::create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make(self::PASSWORD),
            'role' => 'recipient',
            'is_active' => true,
            'email_verified_at' => now(),
        ]);
    }

    /** Past weekday dates (Manila), newest last — clock-in rules never ran on Sundays. */
    private function recentWeekdays(int $count): array
    {
        $days = [];
        $d = Carbon::now('Asia/Manila')->subDay();
        while (count($days) < $count) {
            if (!$d->isSunday()) {
                $days[] = $d->copy();
            }
            $d->subDay();
        }

        return array_reverse($days);
    }

    /** Minimal valid PDF for the demo upload (validation reads the %PDF header). */
    private function demoPdf(): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'promissory').'.pdf';
        file_put_contents($path, "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF");

        return new UploadedFile($path, 'promissory-note.pdf', 'application/pdf', null, true);
    }
}
