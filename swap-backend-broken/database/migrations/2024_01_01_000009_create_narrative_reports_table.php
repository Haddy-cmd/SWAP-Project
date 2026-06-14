<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('narrative_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('time_log_id')->unique()->constrained()->cascadeOnDelete();
            $table->text('content');
            $table->text('activities_done');
            $table->text('challenges')->nullable();
            $table->timestamp('submitted_at')->useCurrent();
            $table->timestamps();

            $table->index('time_log_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('narrative_reports');
    }
};
