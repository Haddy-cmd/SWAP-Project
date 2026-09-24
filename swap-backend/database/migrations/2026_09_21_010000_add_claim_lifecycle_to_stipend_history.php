<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Turns the one-shot "released" stipend row into a claim lifecycle:
 *   pending → certified (available to claim) → claimed (received) | void.
 *
 * The paper 3-part stub becomes one record with a control number and a
 * single-use claim token (the QR the Banking Office verifies). Legacy rows keep
 * their existing 'released' status and simply carry null lifecycle columns.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stipend_history', function (Blueprint $table) {
            // Acknowledgment Receipt identity — shown to the Banking Office.
            $table->string('control_number')->nullable()->unique()->after('status');
            // Single-use token behind the QR; consumed when receipt is confirmed.
            $table->string('claim_token')->nullable()->unique()->after('control_number');

            $table->foreignId('certified_by')->nullable()->after('claim_token')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('certified_at')->nullable()->after('certified_by');

            $table->timestamp('claimed_at')->nullable()->after('released_at');
            $table->timestamp('receipt_signed_at')->nullable()->after('claimed_at');
            // Free-text officer name for when the Banking Office is external (no login).
            $table->string('releasing_officer_name')->nullable()->after('receipt_signed_at');

            // Archived slip PDF. Lives on the documents disk — see the ephemeral-disk
            // caveat in docs/AUDIT_2026-09.md (R1); receipts must move to object storage.
            $table->string('slip_path')->nullable()->after('releasing_officer_name');

            $table->timestamp('voided_at')->nullable()->after('slip_path');
            $table->string('void_reason')->nullable()->after('voided_at');

            $table->index('control_number');
        });
    }

    public function down(): void
    {
        Schema::table('stipend_history', function (Blueprint $table) {
            $table->dropForeign(['certified_by']);
            $table->dropUnique(['control_number']);
            $table->dropUnique(['claim_token']);
            $table->dropColumn([
                'control_number', 'claim_token', 'certified_by', 'certified_at',
                'claimed_at', 'receipt_signed_at', 'releasing_officer_name',
                'slip_path', 'voided_at', 'void_reason',
            ]);
        });
    }
};
