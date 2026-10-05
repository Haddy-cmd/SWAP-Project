<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When the student was reminded to submit the end-of-term narrative report
 * (TermReportReminderService): once when the required hours are met, once when the
 * term ends. Each reminder goes out at most once per placement.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->timestamp('report_due_hours_at')->nullable();
            $table->timestamp('report_due_ended_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->dropColumn(['report_due_hours_at', 'report_due_ended_at']);
        });
    }
};
