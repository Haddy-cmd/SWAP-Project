<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Admin → System Testing on existing accounts. `users.testing_added_at` marks a real
 * recipient/applicant the admin picked for the shortcuts; `testing_changes` records what
 * each shortcut did to that account so "Remove from testing" can undo it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('testing_added_at')->nullable()->after('is_test_account');
        });

        Schema::create('testing_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('subject_type');
            $table->unsignedBigInteger('subject_id');
            $table->string('action', 16);          // created | updated
            $table->json('old_values')->nullable(); // raw column values before an update
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('testing_changes');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('testing_added_at');
        });
    }
};
