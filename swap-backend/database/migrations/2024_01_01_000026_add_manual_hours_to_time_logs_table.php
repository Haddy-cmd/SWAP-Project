<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('time_logs', function (Blueprint $table) {
            // Manually-granted (bonus) hours added by a supervisor/admin instead of a QR clock-in.
            $table->boolean('is_manual')->default(false)->after('location_flagged');
            $table->string('manual_reason', 255)->nullable()->after('is_manual');
            $table->foreignId('recorded_by')->nullable()->after('manual_reason')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('time_logs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('recorded_by');
            $table->dropColumn(['is_manual', 'manual_reason']);
        });
    }
};
