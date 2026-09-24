<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Hand-drawn/uploaded signature specimen, auto-applied to the
            // stipend signatures this user makes (director co-sign, mentor
            // co-sign). Null = typed name + timestamp rendering.
            $table->string('signature_image_path')->nullable()->after('avatar_path');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('signature_image_path');
        });
    }
};
