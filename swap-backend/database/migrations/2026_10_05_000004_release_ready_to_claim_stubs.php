<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * A stipend release is final since 2026-10-05: no claim QR, Banking Office scan or
 * releasing officer. Stubs still waiting to be claimed (`certified`, legacy `pending`)
 * become `released`: their claim token is cleared (the QR disappears), the recipient's
 * saved signature is attached as the beneficiary signature, and the archived PDF is
 * dropped so the next download re-renders it without the QR.
 */
return new class extends Migration
{
    public function up(): void
    {
        $disk = config('filesystems.documents_disk', 'public');
        $now = now();

        // Loaded up front: each update takes the row out of the status filter, which would
        // make offset-based chunking skip rows.
        DB::table('stipend_history')->whereIn('status', ['certified', 'pending'])->orderBy('id')->get()->each(function ($stub) use ($disk, $now) {
            DB::table('stipend_history')->where('id', $stub->id)->update([
                'status' => 'released',
                'released_at' => $stub->certified_at ?? $now,
                'released_by' => $stub->released_by ?? $stub->certified_by,
                'claim_token' => null,
                'slip_path' => null,
                'updated_at' => $now,
            ]);

            $hasBeneficiary = DB::table('stipend_signatures')
                ->where('stipend_history_id', $stub->id)->where('signatory_role', 'beneficiary')->exists();
            if (!$hasBeneficiary) {
                $user = DB::table('users')->where('id', $stub->user_id)->first(['id', 'name', 'signature_image_path']);
                $copy = null;
                if ($user?->signature_image_path) {
                    // A copy that belongs to the stub (a later redraw doesn't change it).
                    $ext = pathinfo($user->signature_image_path, PATHINFO_EXTENSION) ?: 'png';
                    $target = "stipend-signatures/{$stub->id}/beneficiary.{$ext}";
                    try {
                        $storage = Storage::disk($disk);
                        if ($storage->exists($user->signature_image_path)) {
                            $storage->delete($target);
                            $copy = $storage->copy($user->signature_image_path, $target) ? $target : null;
                        }
                    } catch (\Throwable $e) {
                        Log::warning('Release migration: signature copy failed', ['stipend_id' => $stub->id, 'error' => $e->getMessage()]);
                    }
                }
                DB::table('stipend_signatures')->insert([
                    'stipend_history_id' => $stub->id,
                    'signatory_role' => 'beneficiary',
                    'user_id' => $user?->id,
                    'printed_name' => $user?->name ?? 'Beneficiary',
                    'method' => $copy ? 'drawn' : 'authenticated',
                    'signature_image_path' => $copy,
                    'signed_at' => $stub->certified_at ?? $now,
                    'remarks' => 'Released by the DSA (claim-stub flow retired).',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('audit_logs')->insert([
                'user_id' => null,
                'action' => 'released',
                'auditable_type' => 'App\Models\StipendHistory',
                'auditable_id' => $stub->id,
                'old_values' => json_encode(['status' => $stub->status]),
                'new_values' => json_encode(['status' => 'released', 'migrated' => true]),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        });
    }

    /** The claim-at-the-Banking-Office flow is gone; nothing to go back to. */
    public function down(): void
    {
    }
};
