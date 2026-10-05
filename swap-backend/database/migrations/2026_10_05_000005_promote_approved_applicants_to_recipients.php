<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Since 2026-10-05 approving an application makes the student a recipient right away,
 * before any office assignment, so DSA announcements reach them while they wait to be
 * placed. Students approved before that and still waiting (role `applicant`, their latest
 * application approved) are promoted the same way, with an audit entry each.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::table('users')->where('role', 'applicant')->whereNull('deleted_at')->orderBy('id')->get(['id'])
            ->each(function ($user) use ($now) {
                // The latest application decides: a rejected renewal after an old approval
                // (returned to the applicant portal) must stay an applicant.
                $latest = DB::table('applications')->where('user_id', $user->id)
                    ->orderByDesc('id')->first(['id', 'status']);
                if ($latest?->status !== 'approved') {
                    return;
                }

                DB::table('users')->where('id', $user->id)->update(['role' => 'recipient', 'updated_at' => $now]);
                DB::table('audit_logs')->insert([
                    'user_id' => null,
                    'action' => 'promoted_to_recipient',
                    'auditable_type' => 'App\Models\User',
                    'auditable_id' => $user->id,
                    'old_values' => json_encode(['role' => 'applicant']),
                    'new_values' => json_encode(['role' => 'recipient', 'application_id' => $latest->id, 'migrated' => true]),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            });
    }

    /** Promoted students stay recipients (the rule doesn't go back). */
    public function down(): void
    {
    }
};
