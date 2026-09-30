<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The orientation step was removed: approval itself tells the applicant they
 * passed (the admin decides after the interview), so placement no longer waits on
 * an orientation. Its two tables go with it. down() restores the same schema
 * (not the rows) as 2026_09_28_000002_create_orientation_tables.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('orientation_attendees');
        Schema::dropIfExists('orientation_sessions');
    }

    public function down(): void
    {
        Schema::create('orientation_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('title', 150);
            $table->timestamp('scheduled_at');
            $table->string('mode', 20)->default('in_person');
            $table->string('location', 255)->nullable();
            $table->string('meeting_link', 500)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('scheduled_at');
        });

        Schema::create('orientation_attendees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('orientation_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status', 20)->default('invited');
            $table->foreignId('marked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('marked_at')->nullable();
            $table->timestamps();

            $table->unique(['orientation_session_id', 'user_id']);
            $table->index(['user_id', 'status']);
        });
    }
};
