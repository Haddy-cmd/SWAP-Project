<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The supervisor's 1–5 evaluation is replaced by accepting the end-of-term report with
 * an "eligible / not eligible for renewal" mark (term_evaluations is left as it was; nothing
 * reads it any more). Promissory notes stay open until renewal for the next semester
 * closes, so a semester remembers when its renewal was closed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('term_reports', function (Blueprint $table) {
            $table->timestamp('reviewed_at')->nullable()->after('submitted_at');
            $table->foreignId('reviewed_by')->nullable()->after('reviewed_at')->constrained('users')->nullOnDelete();
            $table->boolean('renewal_eligible')->nullable()->after('reviewed_by');
            $table->text('review_remarks')->nullable()->after('renewal_eligible');
        });

        Schema::table('semester_periods', function (Blueprint $table) {
            $table->timestamp('renewal_closed_at')->nullable()->after('renewal_open');
        });
    }

    public function down(): void
    {
        Schema::table('semester_periods', function (Blueprint $table) {
            $table->dropColumn('renewal_closed_at');
        });

        Schema::table('term_reports', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reviewed_by');
            $table->dropColumn(['reviewed_at', 'renewal_eligible', 'review_remarks']);
        });
    }
};
