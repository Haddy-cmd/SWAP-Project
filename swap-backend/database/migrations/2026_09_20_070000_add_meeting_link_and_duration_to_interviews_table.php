<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Online interviews need a joinable link, kept separate from `location` so the
     * venue stays a venue. `duration_minutes` exists so the scheduling rules can
     * check that an interview both STARTS and ENDS inside its allowed window.
     */
    public function up(): void
    {
        Schema::table('interviews', function (Blueprint $table) {
            $table->string('meeting_link', 500)->nullable()->after('location');
            $table->unsignedSmallInteger('duration_minutes')->default(30)->after('meeting_link');
        });
    }

    public function down(): void
    {
        Schema::table('interviews', function (Blueprint $table) {
            $table->dropColumn(['meeting_link', 'duration_minutes']);
        });
    }
};
