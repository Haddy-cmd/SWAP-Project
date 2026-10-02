<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The DSA's semester calendar: one row per academic year + semester with its
 * start and end dates. It is the single source of truth for term dates (the
 * promissory window, pace, renewal rollover, the end-of-term job) and for which
 * term renewal is open. Replaces the never-editable `semester_end_date` setting
 * and the global `renewal_open/year/semester` settings. An assignment's own
 * start/end dates still win as per-placement overrides.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('semester_periods', function (Blueprint $table) {
            $table->id();
            $table->string('academic_year', 20);
            $table->string('semester', 20);
            $table->date('start_date');
            $table->date('end_date');
            // At most one period has renewal open at a time (enforced in the service).
            $table->boolean('renewal_open')->default(false);
            // Stamped when the end-of-term job first closes this period.
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['academic_year', 'semester']);
            $table->index(['start_date', 'end_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('semester_periods');
    }
};
