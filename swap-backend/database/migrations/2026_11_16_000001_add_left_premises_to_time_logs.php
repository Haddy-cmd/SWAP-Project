<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When a clocked-in recipient was first seen outside their office geofence (cleared when they
 * return), and the latest outside reading. Kept on the server so the 10-minute auto clock-out
 * countdown survives page reloads and is finished by the server even with the app closed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('time_logs', function (Blueprint $table) {
            $table->timestamp('left_premises_at')->nullable()->after('clocked_out_reason');
            $table->decimal('outside_lat', 10, 7)->nullable()->after('left_premises_at');
            $table->decimal('outside_lng', 10, 7)->nullable()->after('outside_lat');
            $table->decimal('outside_accuracy', 8, 2)->nullable()->after('outside_lng');
        });
    }

    public function down(): void
    {
        Schema::table('time_logs', function (Blueprint $table) {
            $table->dropColumn(['left_premises_at', 'outside_lat', 'outside_lng', 'outside_accuracy']);
        });
    }
};
