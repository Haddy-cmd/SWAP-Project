<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('weekly_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assignment_id')->constrained()->cascadeOnDelete();
            $table->string('academic_year', 20);
            $table->string('semester', 20);
            $table->unsignedSmallInteger('week_number');
            $table->date('week_start');
            $table->date('week_end');
            $table->decimal('total_hours', 6, 2)->default(0);
            $table->decimal('verified_hours', 6, 2)->default(0);
            $table->unsignedTinyInteger('days_present')->default(0);
            $table->json('log_ids')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'academic_year', 'semester', 'week_number']);
            $table->index('user_id');
            $table->index('assignment_id');
            $table->index('week_start');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weekly_reports');
    }
};
