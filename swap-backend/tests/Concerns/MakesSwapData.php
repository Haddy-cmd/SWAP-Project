<?php

namespace Tests\Concerns;

use App\Models\Assignment;
use App\Models\NarrativeReport;
use App\Models\Office;
use App\Models\TimeLog;
use App\Models\User;
use App\Services\QrCodeService;
use Illuminate\Support\Carbon;

trait MakesSwapData
{
    protected int $seq = 0;

    protected function makeUser(string $role, array $attrs = []): User
    {
        $this->seq++;

        return User::create(array_merge([
            'name' => ucfirst($role)." User {$this->seq}",
            'email' => "{$role}{$this->seq}_".uniqid().'@test.msu-marawi.edu.ph',
            'password' => 'Password@123',
            'role' => $role,
            'is_active' => true,
        ], $attrs));
    }

    protected function makeOffice(array $attrs = []): Office
    {
        $this->seq++;

        return Office::create(array_merge([
            'name' => "Office {$this->seq}",
            'code' => "OFC{$this->seq}",
            'description' => 'Test office',
            'max_recipients' => 10,
            'is_active' => true,
        ], $attrs));
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

    protected function addNarrative(TimeLog $log): NarrativeReport
    {
        return $log->narrativeReport()->create([
            'content' => 'This is a detailed narrative report describing the work rendered during the shift.',
            'activities_done' => 'Filed documents, assisted staff, organized records.',
            'challenges' => 'No major challenges encountered.',
            'submitted_at' => now(),
        ]);
    }
}
