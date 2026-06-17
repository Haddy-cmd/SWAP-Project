<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('time_logs', function (Blueprint $table) {
            // GPS accuracy (meters) reported by the device at clock-in / clock-out.
            $table->decimal('time_in_accuracy', 8, 2)->nullable()->after('time_in_lng');
            $table->decimal('time_out_accuracy', 8, 2)->nullable()->after('time_out_lng');
            // Set when the location could not be trusted (poor accuracy / missing fix).
            $table->boolean('location_flagged')->default(false)->after('clocked_out_reason');
        });
    }

    public function down(): void
    {
        Schema::table('time_logs', function (Blueprint $table) {
            $table->dropColumn(['time_in_accuracy', 'time_out_accuracy', 'location_flagged']);
        });
    }
};
