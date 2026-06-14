<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stipend_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 10, 2);
            $table->string('academic_year', 20);
            $table->string('semester', 20);
            $table->string('period_label')->nullable();
            $table->string('status', 20)->default('pending'); // pending | released
            $table->foreignId('released_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('released_at')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->index('user_id');
            $table->index('status');
            $table->index('academic_year');
            $table->index('released_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stipend_history');
    }
};
