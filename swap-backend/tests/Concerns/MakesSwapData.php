<?php

namespace Tests\Concerns;

use App\Models\Assignment;
use App\Models\NarrativeReport;
use App\Models\Office;
use App\Models\StipendHistory;
use App\Models\TermReport;
use App\Models\TimeLog;
use App\Models\User;
use App\Services\QrCodeService;
use App\Support\BankingOfficePin;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

trait MakesSwapData
{
    protected int $seq = 0;

    /**
     * A future weekday at `hour` o'clock Manila time, at least `minDays` away.
     * Interview rules are expressed in Asia/Manila while the app clock is UTC, so
     * a bare now()->addDays() drifts out of the window depending on when the
     * suite runs. Send it with its offset (toIso8601String()).
     */
    protected static function manilaSlot(int $minDays, int $hour): Carbon
    {
        $at = Carbon::now(\App\Support\InterviewWindow::TIMEZONE)
            ->addDays($minDays)
            ->setTime($hour, 0, 0, 0);

        while ($at->isWeekend()) {
            $at->addDay();
        }

        return $at;
    }

    protected function makeUser(string $role, array $attrs = []): User
    {
        $this->seq++;

        $user = User::create(array_merge([
            'name' => ucfirst($role)." User {$this->seq}",
            'email' => "{$role}{$this->seq}_".uniqid().'@test.msu-marawi.edu.ph',
            'password' => 'Password@123',
            'role' => $role,
            'is_active' => true,
            // Clock-in requires a specimen and release checks its file: recipients
            // carry one by default (written below on the faked disk). Pass explicit
            // null to simulate one who never saved a signature.
            'signature_image_path' => $role === 'recipient' ? 'signatures/test.png' : null,
            // Releases require the director's title: test admins carry one by
            // default; pass explicit null to simulate a title-less admin.
            'position_title' => $role === 'admin' ? 'Test Director' : null,
        ], $attrs));

        if ($user->signature_image_path === 'signatures/test.png') {
            $disk = Storage::disk(config('filesystems.documents_disk', 'public'));
            if (!$disk->exists('signatures/test.png')) {
                $disk->put('signatures/test.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='));
            }
        }

        return $user;
    }

    protected function makeOffice(array $attrs = []): Office
    {
        $this->seq++;

        return Office::create(array_merge([
            'name' => "Office {$this->seq}",
            'description' => 'Test office',
            'max_recipients' => 10,
            'is_active' => true,
        ], $attrs));
    }

    /**
     * A supervisor who does not require a clock-in selfie, so tests about other
     * attendance rules can clock in without attaching a photo.
     */
    protected function makeSupervisorWithoutSelfie(array $attrs = []): User
    {
        return $this->makeUser('supervisor', array_merge(['require_clock_in_selfie' => false], $attrs));
    }

    protected function makeAssignment(User $recipient, User $supervisor, ?Office $office = null, array $attrs = []): Assignment
    {
        $office ??= $this->makeOffice();

        return Assignment::create(array_merge([
            'user_id' => $recipient->id,
            'office_id' => $office->id,
            'supervisor_id' => $supervisor->id,
            'academic_year' => '2024-2025',
            'semester' => '1st Semester',
            'required_hours' => 240,
            'start_date' => Carbon::today()->toDateString(),
            'status' => 'active',
        ], $attrs));
    }

    protected function makeGeofencedOffice(array $attrs = []): Office
    {
        return $this->makeOffice(array_merge([
            'geofence_enabled' => true,
            'latitude' => 8.0,
            'longitude' => 124.0,
            'radius_meters' => 100,
        ], $attrs));
    }

    protected function qrFor(Assignment $assignment): string
    {
        return app(QrCodeService::class)->generateForAssignment($assignment->fresh());
    }

    protected function qrForOffice(Office $office): string
    {
        return app(QrCodeService::class)->generateForOffice($office->fresh());
    }

    protected function makeOpenLog(Assignment $assignment, User $recipient, ?Carbon $timeIn = null): TimeLog
    {
        return TimeLog::create([
            'assignment_id' => $assignment->id,
            'user_id' => $recipient->id,
            'date' => Carbon::today()->toDateString(),
            'time_in' => $timeIn ?? now()->subHours(3),
            'status' => 'open',
        ]);
    }

    /** A finished shift of `$hours` (duration_hours is generated from the span). */
    protected function makeClosedLog(Assignment $assignment, float $hours, string $status = 'verified', int $daysAgo = 10): TimeLog
    {
        $in = Carbon::now()->subDays($daysAgo)->setTime(8, 0);

        return TimeLog::create([
            'assignment_id' => $assignment->id,
            'user_id' => $assignment->user_id,
            'date' => $in->toDateString(),
            'time_in' => $in,
            'time_out' => $in->copy()->addMinutes((int) round($hours * 60)),
            'status' => $status,
        ]);
    }

    protected function addNarrative(TimeLog $log): NarrativeReport
    {
        return $log->narrativeReport()->create([
            'content' => 'This is a detailed narrative report describing the work rendered during the shift.',
            'activities_done' => 'Filed documents, assisted staff, organized records.',
            'challenges' => 'No major challenges encountered.',
            'submitted_at' => now(),
        ]);
    }

    /** The end-of-term narrative report a stipend release requires (StipendClaimService). */
    protected function submitTermReport(Assignment $assignment): TermReport
    {
        return TermReport::create([
            'assignment_id' => $assignment->id,
            'user_id' => $assignment->user_id,
            'content' => str_repeat('Filed records and assisted the office staff throughout the term. ', 3),
            'submitted_at' => now(),
        ]);
    }

    protected const UBO_PIN = '123456';

    /**
     * The Banking Office records the payout: scans the stub's QR and enters the
     * PIN. The DSA set up `$officer` with that PIN, so that is the name recorded.
     */
    protected function bankingOfficeRelease(StipendHistory $stipend, string $officer = 'Cashier Jane Doe'): \Illuminate\Testing\TestResponse
    {
        BankingOfficePin::set(self::UBO_PIN, $officer);

        return $this->postJson("/api/stipend/verify/{$stipend->claim_token}/release", ['pin' => self::UBO_PIN]);
    }
}
