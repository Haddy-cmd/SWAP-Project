<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->unique()->constrained()->cascadeOnDelete();
            $table->timestamp('scheduled_at');
            $table->string('location')->nullable();
            $table->string('mode', 20)->default('in_person');
            $table->text('notes')->nullable();
            $table->string('status', 30)->default('scheduled');
            $table->timestamps();

            $table->index('application_id');
            $table->index('scheduled_at');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interviews');
    }
};
