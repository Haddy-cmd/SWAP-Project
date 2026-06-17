<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('time_logs', function (Blueprint $table) {
            $table->string('clocked_out_reason', 20)->nullable()->after('rejection_reason');
            $table->decimal('time_in_lat', 10, 8)->nullable()->after('time_in');
            $table->decimal('time_in_lng', 11, 8)->nullable()->after('time_in_lat');
            $table->decimal('time_out_lat', 10, 8)->nullable()->after('time_out');
            $table->decimal('time_out_lng', 11, 8)->nullable()->after('time_out_lat');
        });
    }

    public function down(): void
    {
        Schema::table('time_logs', function (Blueprint $table) {
            $table->dropColumn([
                'clocked_out_reason', 'time_in_lat', 'time_in_lng', 'time_out_lat', 'time_out_lng',
            ]);
        });
    }
};
