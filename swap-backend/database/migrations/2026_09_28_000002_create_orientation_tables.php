<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The orientation step between approval and office placement (the DSA's
 * traditional briefing). Admins schedule sessions, invite approved applicants,
 * and mark who attended; a new applicant must have attended one before they can
 * be placed, unless the admin places them anyway (audited).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orientation_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('title', 150);
            $table->timestamp('scheduled_at');
            $table->string('mode', 20)->default('in_person'); // in_person | online
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
            $table->string('status', 20)->default('invited'); // invited | attended | absent
            $table->foreignId('marked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('marked_at')->nullable();
            $table->timestamps();

            $table->unique(['orientation_session_id', 'user_id']);
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orientation_attendees');
        Schema::dropIfExists('orientation_sessions');
    }
};
