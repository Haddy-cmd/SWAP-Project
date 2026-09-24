<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('promissory_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('academic_year', 20);
            $table->string('semester', 20);
            // Hours snapshot at submit time; the makeup the supervisor sets on approval.
            $table->decimal('verified_hours_snapshot', 8, 2);
            $table->decimal('lacking_hours', 8, 2)->nullable();
            // Uploaded promissory document (documents disk; same pattern as applications).
            $table->string('file_path');
            $table->string('file_name');
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->text('reason');
            // pending | approved | rejected. Single-pending-per-assignment is enforced
            // in PromissoryService (a DB partial unique index can't express "pending only").
            $table->string('status', 20)->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_remarks')->nullable();
            // Fixed policy: exactly 1 week after the semester end (server-computed).
            $table->date('makeup_deadline')->nullable();
            $table->timestamps();

            $table->index('assignment_id');
            $table->index('user_id');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('promissory_notes');
    }
};
