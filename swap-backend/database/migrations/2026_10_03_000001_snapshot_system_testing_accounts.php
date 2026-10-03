<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * System Testing restores a picked account from a full copy of its record taken when it
 * was picked (App\Support\AccountSnapshot), instead of replaying a journal of what the
 * testing buttons did — so changes made on the normal pages during a test (a renewal
 * approval, a note the student filed) are undone too. The journal table goes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('testing_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->timestamp('taken_at');
            $table->json('data');
            $table->timestamps();
        });

        Schema::dropIfExists('testing_changes');
    }

    public function down(): void
    {
        Schema::create('testing_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('subject_type');
            $table->unsignedBigInteger('subject_id');
            $table->string('action', 16);
            $table->json('old_values')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('user_id');
        });

        Schema::dropIfExists('testing_snapshots');
    }
};
