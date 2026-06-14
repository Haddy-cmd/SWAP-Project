<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('semester_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assignment_id')->constrained()->cascadeOnDelete();
            $table->string('academic_year', 20);
            $table->string('semester', 20);
            $table->decimal('required_hours', 7, 2)->default(120);
            $table->decimal('verified_hours', 7, 2)->default(0);
            $table->decimal('rendered_hours', 7, 2)->default(0);
            $table->decimal('rejected_hours', 7, 2)->default(0);
            $table->unsignedSmallInteger('total_days_present')->default(0);
            $table->string('final_status', 20)->default('ongoing');
            $table->timestamps();

            $table->unique(['user_id', 'academic_year', 'semester']);
            $table->index('user_id');
            $table->index('assignment_id');
        });

        // GENERATED ALWAYS AS STORED — PostgreSQL computes this automatically
        DB::statement(
            "ALTER TABLE semester_reports ADD COLUMN completion_rate NUMERIC(6,2) GENERATED ALWAYS AS " .
            "(ROUND((verified_hours / NULLIF(required_hours, 0)) * 100, 2)) STORED"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('semester_reports');
    }
};
