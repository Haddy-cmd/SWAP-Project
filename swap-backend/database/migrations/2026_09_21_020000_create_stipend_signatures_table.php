<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Each signature on a stipend claim stub — one row per signatory. The DSA side
 * (chairperson, director) signs at certification; the beneficiary and the
 * releasing officer sign at receipt. The authoritative record is this row plus
 * the audit log; the optional image is only for the printed slip's familiarity.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stipend_signatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stipend_history_id')->constrained('stipend_history')->cascadeOnDelete();
            // chairperson | director | beneficiary | releasing_officer
            $table->string('signatory_role', 32);
            // Null for an external releasing officer with no portal account.
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('printed_name');
            // authenticated (in-system confirmation) | drawn (uploaded image)
            $table->string('method', 20)->default('authenticated');
            $table->string('signature_image_path')->nullable();
            $table->timestamp('signed_at');
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->index('stipend_history_id');
            $table->index('signatory_role');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stipend_signatures');
    }
};
