<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The shortfall a promissory note covers, persisted where it is paid: the note keeps
 * the term's deficient hours from submission, and a stub released through a note
 * records the note, the deficiency and the makeup it promised (the stub prints them).
 * Existing rows are backfilled — notes from their snapshot, stubs from the
 * "via approved promissory #N" remark that used to be the only trace.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promissory_notes', function (Blueprint $table) {
            $table->decimal('deficient_hours', 8, 2)->nullable()->after('lacking_hours');
        });

        Schema::table('stipend_history', function (Blueprint $table) {
            $table->boolean('via_promissory')->default(false)->after('remarks');
            $table->foreignId('promissory_note_id')->nullable()->after('via_promissory')->constrained('promissory_notes')->nullOnDelete();
            $table->decimal('required_hours', 8, 2)->nullable()->after('promissory_note_id');
            $table->decimal('deficient_hours', 8, 2)->nullable()->after('required_hours');
            $table->decimal('lacking_hours', 8, 2)->nullable()->after('deficient_hours');
            $table->date('makeup_deadline')->nullable()->after('lacking_hours');
        });

        $this->backfill();
    }

    private function backfill(): void
    {
        $required = DB::table('assignments')->pluck('required_hours', 'id');

        DB::table('promissory_notes')->whereNull('deficient_hours')->eachById(function ($note) use ($required) {
            $req = (float) ($required[$note->assignment_id] ?? 0);
            if ($req > 0) {
                DB::table('promissory_notes')->where('id', $note->id)->update([
                    'deficient_hours' => max(0, round($req - (float) $note->verified_hours_snapshot, 2)),
                ]);
            }
        });

        DB::table('stipend_history')->where('remarks', 'like', '%via approved promissory #%')->eachById(function ($stub) use ($required) {
            if (!preg_match('/via approved promissory #(\d+)/', (string) $stub->remarks, $m)) {
                return;
            }
            $note = DB::table('promissory_notes')->where('id', (int) $m[1])->first();
            if (!$note) {
                return;
            }
            DB::table('stipend_history')->where('id', $stub->id)->update([
                'via_promissory' => true,
                'promissory_note_id' => $note->id,
                'required_hours' => $required[$note->assignment_id] ?? null,
                'deficient_hours' => $note->deficient_hours,
                'lacking_hours' => $note->lacking_hours,
                'makeup_deadline' => $note->makeup_deadline,
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('stipend_history', function (Blueprint $table) {
            $table->dropConstrainedForeignId('promissory_note_id');
            $table->dropColumn(['via_promissory', 'required_hours', 'deficient_hours', 'lacking_hours', 'makeup_deadline']);
        });

        Schema::table('promissory_notes', function (Blueprint $table) {
            $table->dropColumn('deficient_hours');
        });
    }
};
