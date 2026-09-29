<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use App\Models\StipendHistory;
use App\Models\User;
use App\Services\StipendClaimService;
use App\Services\StipendSlipService;
use App\Support\BankingOfficePin;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Throwaway data for testing the Banking Office PIN / scan-to-release flow:
 *   - 3 recipients (pin-test1..3@test.swap, password Password123!)
 *   - 2 stubs ready to claim, 1 already claimed, 1 voided
 *
 * Re-runnable: it removes its own previous rows first. It never sets the PIN —
 * set it yourself on Admin → Stipend, which is part of what is being tested.
 * Prints each stub's claim link (the URL its QR code carries). Run with:
 *   php artisan db:seed --class=BankingOfficePinTestSeeder
 */
class BankingOfficePinTestSeeder extends Seeder
{
    private const EMAIL = 'pin-test%d@test.swap';
    private const YEAR = '2025-2026';

    public function run(): void
    {
        $this->wipePrevious();

        $password = Hash::make('Password123!');
        $student = fn (int $n) => User::create([
            'name' => "PIN Test Student {$n}",
            'email' => sprintf(self::EMAIL, $n),
            'password' => $password,
            'role' => 'recipient',
            'is_active' => true,
            'email_verified_at' => now(),
        ]);

        $s1 = $student(1);
        $s2 = $student(2);
        $s3 = $student(3);

        $rows = [
            [$s1, $this->stub($s1, '2nd Semester', 'SWAP-STP-DEMO-00001'), 'Ready to claim — test a wrong PIN, then the right one'],
            [$s2, $this->stub($s2, '2nd Semester', 'SWAP-STP-DEMO-00002'), 'Ready to claim — use for the 7-tries lockout'],
            [$s3, $this->stub($s3, '2nd Semester', 'SWAP-STP-DEMO-00003'), 'Already claimed — must show "Do not release"'],
            [$s3, $this->stub($s3, '1st Semester', 'SWAP-STP-DEMO-00004'), 'Voided by the DSA — must show "Do not release"'],
        ];

        // Keep the links before the claimed/voided stubs lose their tokens.
        $links = array_map(fn ($r) => StipendSlipService::claimUrl($r[1]), $rows);

        app(StipendClaimService::class)->releaseAtBankingOffice($rows[2][1], 'Maria Santos (demo officer)');
        $rows[3][1]->update([
            'status' => StipendHistory::STATUS_VOID,
            'claim_token' => null,
            'voided_at' => now(),
            'void_reason' => 'Demo: issued with the wrong amount',
        ]);

        $this->command->info('Banking Office PIN test data created. Students log in with Password123!');
        $this->command->info('PIN is currently ' . (BankingOfficePin::isSet() ? 'SET' : 'NOT SET (set it on Admin → Stipend)') . '.');
        $this->command->table(
            ['Student (login)', 'Control No.', 'What to test', 'Claim link (what the QR opens)'],
            array_map(fn ($r, $link) => [$r[0]->email, $r[1]->control_number, $r[2], $link], $rows, $links),
        );
    }

    /** A certified stub with its PDF archived, as a real release would leave it. */
    private function stub(User $user, string $semester, string $control): StipendHistory
    {
        $stub = StipendHistory::create([
            'user_id' => $user->id,
            'amount' => 5000,
            'academic_year' => self::YEAR,
            'semester' => $semester,
            'status' => StipendHistory::STATUS_CERTIFIED,
            'control_number' => $control,
            'claim_token' => Str::random(64),
            'certified_at' => now(),
            'remarks' => 'Demo stub for Banking Office PIN testing.',
        ]);
        $stub->update(['slip_path' => app(StipendSlipService::class)->render($stub)]);

        return $stub;
    }

    private function wipePrevious(): void
    {
        $ids = User::withTrashed()->where('email', 'like', 'pin-test%@test.swap')->pluck('id');
        if ($ids->isEmpty()) {
            return;
        }

        $disk = Storage::disk(config('filesystems.documents_disk', 'public'));
        $stubIds = StipendHistory::whereIn('user_id', $ids)->pluck('id');
        foreach ($stubIds as $id) {
            $disk->deleteDirectory("stipend-slips/{$id}");
            $disk->deleteDirectory("stipend-signatures/{$id}");
        }

        AuditLog::where('auditable_type', StipendHistory::class)->whereIn('auditable_id', $stubIds)->delete();
        DB::table('notifications')->where('notifiable_type', User::class)->whereIn('notifiable_id', $ids)->delete();
        DB::table('personal_access_tokens')->where('tokenable_type', User::class)->whereIn('tokenable_id', $ids)->delete();
        StipendHistory::whereIn('id', $stubIds)->delete(); // signature rows cascade
        User::withTrashed()->whereIn('id', $ids)->forceDelete();
    }
}
