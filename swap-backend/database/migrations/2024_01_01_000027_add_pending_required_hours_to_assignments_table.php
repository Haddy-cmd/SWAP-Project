<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            // An admin-requested required-hours change awaiting the supervisor's approval.
            $table->unsignedSmallInteger('pending_required_hours')->nullable()->after('required_hours');
            $table->foreignId('pending_required_by')->nullable()->after('pending_required_hours')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pending_required_by');
            $table->dropColumn('pending_required_hours');
        });
    }
};
