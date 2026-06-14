<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("CREATE TYPE application_status AS ENUM ('submitted','under_review','interview_scheduled','approved','rejected')");

        Schema::create('applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('academic_year', 20);
            $table->string('semester', 20);
            $table->text('remarks')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'academic_year', 'semester']);
            $table->index('user_id');
            $table->index('academic_year');
        });

        DB::statement("ALTER TABLE applications ADD COLUMN status application_status NOT NULL DEFAULT 'submitted'");
        DB::statement('CREATE INDEX applications_status_idx ON applications (status)');
    }

    public function down(): void
    {
        Schema::dropIfExists('applications');
        DB::statement('DROP TYPE IF EXISTS application_status');
    }
};
