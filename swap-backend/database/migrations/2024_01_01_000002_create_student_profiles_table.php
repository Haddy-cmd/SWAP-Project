<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('student_id_number')->unique();
            $table->string('first_name');
            $table->string('middle_name')->nullable();
            $table->string('last_name');
            $table->date('date_of_birth')->nullable();
            $table->string('gender', 10)->nullable();
            $table->string('contact_number', 20)->nullable();
            $table->text('address')->nullable();
            $table->string('college');
            $table->string('program');
            $table->tinyInteger('year_level');
            $table->decimal('gpa', 4, 2)->nullable();
            $table->string('photo_url')->nullable();
            $table->timestamps();

            $table->index('student_id_number');
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_profiles');
    }
};
