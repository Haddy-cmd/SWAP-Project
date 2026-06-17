<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('offices', function (Blueprint $table) {
            $table->decimal('latitude', 10, 8)->nullable()->after('location');
            $table->decimal('longitude', 11, 8)->nullable()->after('latitude');
            $table->unsignedSmallInteger('radius_meters')->default(100)->after('longitude');
            $table->boolean('geofence_enabled')->default(false)->after('radius_meters');
            $table->text('qr_code')->nullable()->after('geofence_enabled');
            $table->string('qr_secret', 255)->nullable()->after('qr_code');
        });
    }

    public function down(): void
    {
        Schema::table('offices', function (Blueprint $table) {
            $table->dropColumn([
                'latitude', 'longitude', 'radius_meters', 'geofence_enabled', 'qr_code', 'qr_secret',
            ]);
        });
    }
};
