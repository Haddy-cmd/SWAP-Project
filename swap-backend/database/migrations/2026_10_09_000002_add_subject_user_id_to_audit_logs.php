<?php

use App\Models\AuditLog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Audit Logs: who each entry is *about* (the student or account), so the log can be filtered by
 * student and each record shows its own history. Existing rows are filled from the record they
 * point at (AuditLog::SUBJECT_PATHS); rows that can't be traced stay empty.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->foreignId('subject_user_id')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
            $table->index('subject_user_id');
        });

        // The account itself — except entries where the account is just the one acting.
        DB::table('audit_logs')
            ->where('auditable_type', 'App\Models\User')
            ->whereNotIn('action', AuditLog::ACTOR_ONLY_ACTIONS)
            ->whereIn('auditable_id', DB::table('users')->select('id')) // hard-deleted accounts stay empty
            ->update(['subject_user_id' => DB::raw('auditable_id')]);

        foreach (AuditLog::SUBJECT_PATHS as $type => [$table, $via]) {
            if (!Schema::hasTable($table)) {
                continue;
            }
            $ids = DB::table('audit_logs')->where('auditable_type', $type)->distinct()->pluck('auditable_id');
            foreach ($ids->chunk(500) as $chunk) {
                $owners = AuditLog::ownersOf($table, $via, $chunk->all());
                $existing = DB::table('users')->whereIn('id', array_unique(array_values($owners)))->pluck('id')->flip();
                $owners = array_filter($owners, fn ($userId) => $existing->has($userId));
                foreach ($owners as $auditableId => $userId) {
                    DB::table('audit_logs')->where('auditable_type', $type)->where('auditable_id', $auditableId)
                        ->update(['subject_user_id' => $userId]);
                }
            }
        }
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('subject_user_id');
        });
    }
};
