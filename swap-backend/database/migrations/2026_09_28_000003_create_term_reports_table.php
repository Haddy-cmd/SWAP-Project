<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One end-of-term narrative report per assignment (the traditional single report),
 * replacing the per-session narrative as the payout requirement. The recipient
 * writes and edits it until their stipend is released; the supervisor reads it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('term_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('content');
            $table->text('accomplishments')->nullable();
            $table->text('challenges')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('term_reports');
    }
};
