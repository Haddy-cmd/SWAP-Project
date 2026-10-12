<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * A student has at most one active placement. Before that rule an admin could place a student
 * in a second term while another placement was still active, and screens disagreed on which one
 * was "current". For every such student, keep the newest placement active and complete the rest
 * (their logs and hours stay with them). Recorded in the audit log; safe to run again.
 */
return new class extends Migration
{
    public function up(): void
    {
        $users = DB::table('assignments')->where('status', 'active')
            ->groupBy('user_id')->havingRaw('COUNT(*) > 1')->pluck('user_id');

        foreach ($users as $userId) {
            $active = DB::table('assignments')->where('user_id', $userId)->where('status', 'active')
                ->orderByDesc('id')->get(['id', 'academic_year', 'semester', 'office_id']);
            $keep = $active->first();

            foreach ($active->slice(1) as $old) {
                DB::table('assignments')->where('id', $old->id)->update(['status' => 'completed', 'updated_at' => now()]);
                DB::table('audit_logs')->insert([
                    'user_id' => null,
                    'subject_user_id' => $userId,
                    'action' => 'placement_closed_duplicate',
                    'auditable_type' => 'App\\Models\\Assignment',
                    'auditable_id' => $old->id,
                    'old_values' => json_encode(['status' => 'active']),
                    'new_values' => json_encode(['status' => 'completed', 'kept_assignment_id' => $keep->id]),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // Data fix only: which placement was meant to stay can't be undone safely.
    }
};
