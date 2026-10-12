<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * There is no "Office of the Dean of Student Affairs" at MSU Marawi: the DSA is the
 * Division of Student Affairs. The old default interview venue, the seeded office and
 * the interview FAQ saved the wrong name; correct the stored copies. An office is not
 * renamed onto a name another office already has (its other columns are still fixed).
 * Each changed row gets an audit_logs entry.
 */
return new class extends Migration
{
    private const RIGHT = 'Division of Student Affairs';
    /** Longest first, so "Office of the Dean of …" doesn't leave "Office of the Division of …". */
    private const WRONG = ['/Office of the Dean of Student Affairs/i', '/Dean of Student Affairs/i'];

    /** table => [model class for the audit trail, columns to correct] */
    private const TARGETS = [
        'interviews' => [\App\Models\Interview::class, ['location']],
        'offices' => [\App\Models\Office::class, ['name', 'location', 'description']],
        'users' => [\App\Models\User::class, ['position_title']],
        'faq_knowledge_base' => [\App\Models\FaqKnowledgeBase::class, ['question', 'answer']],
    ];

    public function up(): void
    {
        foreach (self::TARGETS as $table => [$model, $columns]) {
            $rows = DB::table($table)
                ->where(function ($q) use ($columns) {
                    foreach ($columns as $column) {
                        $q->orWhere($column, 'ilike', '%Dean of Student Affairs%');
                    }
                })
                ->get(array_merge(['id'], $columns));

            foreach ($rows as $row) {
                $old = [];
                $new = [];
                foreach ($columns as $column) {
                    $value = $row->{$column};
                    if (!is_string($value) || stripos($value, 'Dean of Student Affairs') === false) {
                        continue;
                    }
                    $fixed = preg_replace(self::WRONG, self::RIGHT, $value);
                    if ($table === 'offices' && $column === 'name'
                        && DB::table('offices')->where('id', '!=', $row->id)->whereRaw('lower(name) = lower(?)', [$fixed])->exists()) {
                        continue;
                    }
                    $old[$column] = $value;
                    $new[$column] = $fixed;
                }
                if (!$new) {
                    continue;
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
        // Intentionally irreversible: the Division of Student Affairs is the right name.
    }
};
