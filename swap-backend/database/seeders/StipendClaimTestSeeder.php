<?php

namespace Database\Seeders;

use App\Models\StipendHistory;
use App\Models\User;
use App\Services\StipendClaimService;
use Illuminate\Database\Seeder;

/**
 * TEST-ONLY seeder: mints one certified claim stub (control number + claim
 * token + signatures + slip PDF + "ready to claim" notification) through the
 * real StipendClaimService::releaseClaimStub() code path, so the recipient
 * stipend page shows a downloadable Claim Slip. Safe to re-run: it reuses an
 * existing certified/claimed stub for the same period instead of duplicating.
 */
class StipendClaimTestSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('role', 'admin')->where('is_active', true)->first()
            ?? User::where('role', 'admin')->first();

        if (! $admin) {
            $this->command->error('No admin user found — cannot certify a stub.');
            return;
        }

        // Prefer Amir Alonto (the manual-testing account), else any recipient.
        $recipient = User::where('role', 'recipient')->where('name', 'like', '%Amir%')->first()
            ?? User::where('role', 'recipient')->where('email', 'like', '%amir%')->first()
            ?? User::where('role', 'recipient')->first();

        if (! $recipient) {
            $this->command->error('No recipient user found — nothing to release a stub for.');
            return;
        }

        $period = [
            'academic_year' => '2025-2026',
            'semester' => '1st Semester',
            'period_label' => 'September',
        ];

        $existing = StipendHistory::where('user_id', $recipient->id)
            ->where('academic_year', $period['academic_year'])
            ->where('semester', $period['semester'])
            ->whereIn('status', [StipendHistory::STATUS_CERTIFIED, StipendHistory::STATUS_CLAIMED])
            ->first();

        if ($existing) {
            $this->command->info("Reusing existing {$existing->status} stub #{$existing->id} ({$existing->control_number}) for {$recipient->name}.");
            $this->command->info("Slip path: {$existing->slip_path}");
            return;
        }

        $stipend = app(StipendClaimService::class)->releaseClaimStub([
            'user_id' => $recipient->id,
            'amount' => 1000,
            'academic_year' => $period['academic_year'],
            'semester' => $period['semester'],
            'period_label' => $period['period_label'],
            'remarks' => 'Test data — StipendClaimTestSeeder.',
        ], $admin);

        $this->command->info("Certified stub #{$stipend->id} ({$stipend->control_number}) for {$recipient->name} <{$recipient->email}>.");
        $this->command->info("Slip path: {$stipend->slip_path}");
    }
}
