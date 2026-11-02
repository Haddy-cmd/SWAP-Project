<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Whether a clock-in selfie was required when the shift started, so a log made while the
 * supervisor had the selfie off isn't flagged for a missing photo. Earlier logs stay null
 * (not recorded): they follow the student's current setting.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('time_logs', function (Blueprint $table) {
            $table->boolean('selfie_required')->nullable()->after('time_in_photo_path');
        });
    }

    public function down(): void
    {
        Schema::table('time_logs', function (Blueprint $table) {
            $table->dropColumn('selfie_required');
        });
    }
};
