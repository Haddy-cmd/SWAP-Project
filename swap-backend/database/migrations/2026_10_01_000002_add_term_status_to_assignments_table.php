<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The persisted end-of-term verdict (TermStatusService): null while the term is in
 * progress, then qualified or deficient with the shortfall recorded. Set by the
 * daily semester:close job (term_status_by null) or a supervisor's manual mark.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->string('term_status', 20)->nullable()->after('status');
            $table->decimal('deficient_hours', 8, 2)->nullable()->after('term_status');
            $table->timestamp('term_status_at')->nullable()->after('deficient_hours');
            $table->foreignId('term_status_by')->nullable()->after('term_status_at')->constrained('users')->nullOnDelete();
            $table->text('term_status_reason')->nullable()->after('term_status_by');
            $table->index('term_status');
        });
    }

    public function down(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->dropIndex(['term_status']);
            $table->dropConstrainedForeignId('term_status_by');
            $table->dropColumn(['term_status', 'deficient_hours', 'term_status_at', 'term_status_reason']);
        });
    }
};
