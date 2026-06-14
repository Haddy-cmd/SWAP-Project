<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('time_log_id')->constrained()->cascadeOnDelete();
            $table->foreignId('verified_by')->constrained('users')->cascadeOnDelete();
            $table->string('action', 20); // 'verified' | 'rejected'
            $table->text('feedback')->nullable();
            $table->timestamps();

            $table->index('time_log_id');
            $table->index('verified_by');
            $table->index('action');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('verifications');
    }
};
