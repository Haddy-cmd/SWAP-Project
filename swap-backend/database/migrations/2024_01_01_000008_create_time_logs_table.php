<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("DROP TYPE IF EXISTS time_log_status CASCADE");
        DB::statement("CREATE TYPE time_log_status AS ENUM ('open','pending_verification','verified','rejected')");

        Schema::create('time_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->timestamp('time_in');
            $table->timestamp('time_out')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index('assignment_id');
            $table->index('user_id');
            $table->index('date');
            $table->index('verified_by');
        });

        DB::statement("ALTER TABLE time_logs ADD COLUMN status time_log_status NOT NULL DEFAULT 'open'");
        DB::statement('CREATE INDEX time_logs_status_idx ON time_logs (status)');

        // GENERATED ALWAYS AS STORED column — computed by PostgreSQL, never written from PHP
        DB::statement(
            "ALTER TABLE time_logs ADD COLUMN duration_hours NUMERIC(6,2) GENERATED ALWAYS AS " .
            "(ROUND(EXTRACT(EPOCH FROM (time_out - time_in)) / 3600, 2)) STORED"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('time_logs');
        DB::statement('DROP TYPE IF EXISTS time_log_status');
    }
};
