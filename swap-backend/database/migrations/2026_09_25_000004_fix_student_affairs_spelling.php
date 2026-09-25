<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The office is the Division / Office of the Dean of *Student* Affairs. The old
 * default interview venue ("Office of the Dean of Students Affairs (DSA)"), the
 * seeded office name and some typed position titles saved the misspelling;
 * correct the stored copies. Each changed row gets an audit_logs entry.
 */
return new class extends Migration
{
    private const WRONG = 'Students Affairs';
    private const RIGHT = 'Student Affairs';

    /** table => [model class for the audit trail, columns to correct] */
    private const TARGETS = [
        'interviews' => [\App\Models\Interview::class, ['location']],
        'offices' => [\App\Models\Office::class, ['name', 'location', 'description']],
        'users' => [\App\Models\User::class, ['position_title']],
    ];

    public function up(): void
    {
        foreach (self::TARGETS as $table => [$model, $columns]) {
            $rows = DB::table($table)
                ->where(function ($q) use ($columns) {
                    foreach ($columns as $column) {
                        $q->orWhere($column, 'like', '%' . self::WRONG . '%');
                    }
                })
                ->get(array_merge(['id'], $columns));

            foreach ($rows as $row) {
                $old = [];
                $new = [];
                foreach ($columns as $column) {
                    if (is_string($row->{$column}) && str_contains($row->{$column}, self::WRONG)) {
                        $old[$column] = $row->{$column};
                        $new[$column] = str_replace(self::WRONG, self::RIGHT, $row->{$column});
                    }
                }

                DB::table($table)->where('id', $row->id)->update($new);

                DB::table('audit_logs')->insert([
                    'user_id' => null, // system correction
                    'action' => 'spelling_corrected',
                    'auditable_type' => $model,
                    'auditable_id' => $row->id,
                    'old_values' => json_encode($old),
                    'new_values' => json_encode($new),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // Intentionally irreversible: the corrected spelling is the right one.
    }
};
