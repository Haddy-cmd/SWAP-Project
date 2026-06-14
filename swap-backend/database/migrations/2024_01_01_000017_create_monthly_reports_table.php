<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monthly_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assignment_id')->constrained()->cascadeOnDelete();
            $table->string('academic_year', 20);
            $table->string('semester', 20);
            $table->unsignedSmallInteger('month');
            $table->unsignedSmallInteger('year');
            $table->decimal('total_hours', 7, 2)->default(0);
            $table->decimal('verified_hours', 7, 2)->default(0);
            $table->unsignedTinyInteger('days_present')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'assignment_id', 'month', 'year']);
            $table->index('user_id');
            $table->index('assignment_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monthly_reports');
    }
};
