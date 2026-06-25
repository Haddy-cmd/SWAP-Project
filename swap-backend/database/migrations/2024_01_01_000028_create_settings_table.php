<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        // Seed the application-period switch (closed by default).
        DB::table('settings')->insert([
            ['key' => 'applications_open', 'value' => '0', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'applications_closed_message', 'value' => 'The application period has not started yet. Please check back later.', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
