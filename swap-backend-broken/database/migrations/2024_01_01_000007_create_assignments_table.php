<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('office_id')->constrained()->restrictOnDelete();
            $table->foreignId('supervisor_id')->constrained('users')->restrictOnDelete();
            $table->string('academic_year', 20);
            $table->string('semester', 20);
            $table->unsignedSmallInteger('required_hours')->default(120);
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->string('status', 20)->default('active');
            $table->text('qr_code')->unique()->nullable();
            $table->string('qr_secret', 255)->nullable();
            $table->timestamps();

            $table->index('user_id');
            $table->index('office_id');
            $table->index('supervisor_id');
            $table->index('status');
            $table->index('academic_year');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assignments');
    }
};
