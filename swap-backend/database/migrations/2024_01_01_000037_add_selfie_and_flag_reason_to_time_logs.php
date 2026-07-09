<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('time_logs', function (Blueprint $table) {
            // Proof-of-presence selfie captured at clock-in (stored on the documents disk).
            $table->string('time_in_photo_path')->nullable()->after('time_in_accuracy');
            // Why a clock-in was location-flagged (weak GPS / reused coordinates /
            // improbable travel) so the supervisor sees the reason, not just a boolean.
            $table->string('location_flag_reason')->nullable()->after('location_flagged');
        });
    }

    public function down(): void
    {
        Schema::table('time_logs', function (Blueprint $table) {
            $table->dropColumn(['time_in_photo_path', 'location_flag_reason']);
        });
    }
};
