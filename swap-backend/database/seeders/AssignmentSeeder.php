<?php

namespace Database\Seeders;

use App\Models\Assignment;
use App\Models\Office;
use App\Models\User;
use App\Services\QrCodeService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class AssignmentSeeder extends Seeder
{
    public function run(): void
    {
        $qrService = app(QrCodeService::class);

        $recipients = User::where('role', 'recipient')->get();
        $supervisors = User::where('role', 'supervisor')->get();
        $offices = Office::where('is_active', true)->get();

        if ($recipients->isEmpty() || $supervisors->isEmpty() || $offices->isEmpty()) {
            $this->command->warn('Skipping AssignmentSeeder: missing recipients, supervisors, or offices.');

            return;
        }

        $assignments = [
            [
                'user' => $recipients->get(0),
                'office' => $offices->firstWhere('code', 'ITC') ?? $offices->first(),
                'supervisor' => $supervisors->first(),
            ],
            [
                'user' => $recipients->get(1),
                'office' => $offices->firstWhere('code', 'LIB') ?? $offices->skip(1)->first(),
                'supervisor' => $supervisors->skip(1)->first() ?? $supervisors->first(),
            ],
        ];

        foreach ($assignments as $data) {
            if (!$data['user']) {
                continue;
            }

            $assignment = Assignment::create([
                'user_id' => $data['user']->id,
                'office_id' => $data['office']->id,
                'supervisor_id' => $data['supervisor']->id,
                'academic_year' => '2024-2025',
                'semester' => '1st Semester',
                'required_hours' => 120,
                'start_date' => '2024-08-01',
                'end_date' => '2024-12-31',
                'status' => 'active',
                'qr_secret' => Str::random(64),
            ]);

            $qrService->generateForAssignment($assignment);
        }
    }
}
