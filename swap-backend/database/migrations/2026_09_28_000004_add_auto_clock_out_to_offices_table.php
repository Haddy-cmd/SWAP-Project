<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-office switch for the geofence auto clock-out (on by default, as before).
 * Some offices send students on errands off the premises; there the admin turns
 * it off and students clock out by scanning the office QR.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('offices', function (Blueprint $table) {
            $table->boolean('auto_clock_out')->default(true)->after('geofence_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('offices', function (Blueprint $table) {
            $table->dropColumn('auto_clock_out');
        });
    }
};
