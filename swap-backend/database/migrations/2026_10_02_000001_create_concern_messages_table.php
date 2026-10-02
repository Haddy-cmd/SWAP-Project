<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Concerns become a running conversation: every message in a thread (the opener and
 * each reply, from the student or the DSA) is a row here. The `concerns` row stays as
 * the thread header (subject, status) and keeps its denormalized latest-reply columns
 * for the inbox preview, emails and existing queries. Existing concerns are backfilled:
 * the opening message from `concerns.message`, and the one stored reply, if any.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('concern_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('concern_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            // Whose side the message is from, kept independent of the author's current role.
            $table->boolean('from_staff')->default(false);
            $table->text('body');
            $table->timestamps();

            $table->index(['concern_id', 'id']);
        });

        $this->backfill();
    }

    private function backfill(): void
    {
        DB::table('concerns')->orderBy('id')->each(function ($concern) {
            DB::table('concern_messages')->insert([
                'concern_id' => $concern->id,
                'user_id' => $concern->user_id,
                'from_staff' => false,
                'body' => $concern->message,
                'created_at' => $concern->created_at,
                'updated_at' => $concern->created_at,
            ]);

            if (!empty($concern->response)) {
                $when = $concern->responded_at ?? $concern->updated_at ?? $concern->created_at;
                DB::table('concern_messages')->insert([
                    'concern_id' => $concern->id,
                    'user_id' => $concern->responded_by,
                    'from_staff' => true,
                    'body' => $concern->response,
                    'created_at' => $when,
                    'updated_at' => $when,
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('concern_messages');
    }
};
