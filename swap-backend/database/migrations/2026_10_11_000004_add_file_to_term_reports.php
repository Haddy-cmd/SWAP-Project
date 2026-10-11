<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** The end-of-term report can be typed or uploaded (PDF/Word), so content may be empty when a file is attached. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('term_reports', function (Blueprint $table) {
            $table->text('content')->nullable()->change();
            $table->string('file_path')->nullable();
            $table->string('file_name')->nullable();
            $table->string('mime_type', 120)->nullable();
            $table->unsignedInteger('file_size')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('term_reports', function (Blueprint $table) {
            $table->dropColumn(['file_path', 'file_name', 'mime_type', 'file_size']);
        });
    }
};
