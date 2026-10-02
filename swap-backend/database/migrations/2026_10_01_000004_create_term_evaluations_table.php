<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The supervisor's end-of-term evaluation of a placement: a 1–5 rating with
 * remarks; 3 or more passes. A renewal can't be approved without a passed one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('term_evaluations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('evaluator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('remarks');
            $table->boolean('passed');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('term_evaluations');
    }
};
