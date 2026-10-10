<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\DB;

class AuditLog extends Model
{
    use HasFactory;

    public const UPDATED_AT = null;

    /** Entries recorded on the acting account itself: nobody else is the subject. */
    public const ACTOR_ONLY_ACTIONS = ['report_exported', 'testing_released_all', 'testing_switched_on', 'testing_switched_off'];

    /**
     * How to find the student/account an entry is about, per audited model:
     * [table, path] where path is `user_id` on the row, or `application_id` / `assignment_id` /
     * `time_log_id` leading to a row that has one. Models not listed (offices, semesters,
     * announcements…) are about no one in particular.
     */
    public const SUBJECT_PATHS = [
        Application::class => ['applications', 'user_id'],
        Assignment::class => ['assignments', 'user_id'],
        TimeLog::class => ['time_logs', 'user_id'],
        StipendHistory::class => ['stipend_history', 'user_id'],
        PromissoryNote::class => ['promissory_notes', 'user_id'],
        TermReport::class => ['term_reports', 'user_id'],
        StudentProfile::class => ['student_profiles', 'user_id'],
        Concern::class => ['concerns', 'user_id'],
        ConcernMessage::class => ['concern_messages', 'user_id'],
        Interview::class => ['interviews', 'application_id'],
        ApplicationDocument::class => ['application_documents', 'application_id'],
        'App\Models\TermEvaluation' => ['term_evaluations', 'assignment_id'],
        Verification::class => ['verifications', 'time_log_id'],
        NarrativeReport::class => ['narrative_reports', 'time_log_id'],
    ];

    private const PARENT_TABLES = ['application_id' => 'applications', 'assignment_id' => 'assignments', 'time_log_id' => 'time_logs'];

    protected $fillable = [
        'user_id',
        'subject_user_id',
        'action',
        'auditable_type',
        'auditable_id',
        'old_values',
        'new_values',
        'ip_address',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** The student/account the entry is about (null for program-wide changes). */
    public function subject(): BelongsTo
    {
        return $this->belongsTo(User::class, 'subject_user_id');
    }

    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }

    public static function record(
        string $action,
        Model $model,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?int $userId = null
    ): self {
        return self::create([
            'user_id' => $userId ?? auth()->id(),
            'subject_user_id' => self::subjectOf($action, $model),
            'action' => $action,
            'auditable_type' => get_class($model),
            'auditable_id' => $model->getKey(),
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }

    /** Who an entry about this model is about (SUBJECT_PATHS); null when no one in particular. */
    public static function subjectOf(string $action, Model $model): ?int
    {
        if ($model instanceof User) {
            // A user deleted right after (hard delete) can't be referenced.
            return in_array($action, self::ACTOR_ONLY_ACTIONS, true) || !$model->exists ? null : $model->getKey();
        }
        [$table, $via] = self::SUBJECT_PATHS[get_class($model)] ?? [null, null];
        if (!$table) {
            return null;
        }
        if ($via === 'user_id') {
            return $model->getAttribute('user_id');
        }
        $parentId = $model->getAttribute($via);

        return $parentId ? DB::table(self::PARENT_TABLES[$via])->where('id', $parentId)->value('user_id') : null;
    }

    /**
     * auditable_id => user id for rows of $table (the backfill and the presenter share this).
     *
     * @param  list<int>  $ids
     * @return array<int, int>
     */
    public static function ownersOf(string $table, string $via, array $ids): array
    {
        if ($via === 'user_id') {
            return DB::table($table)->whereIn('id', $ids)->whereNotNull('user_id')->pluck('user_id', 'id')->all();
        }
        $parent = self::PARENT_TABLES[$via];

        return DB::table($table)->join($parent, "{$parent}.id", '=', "{$table}.{$via}")
            ->whereIn("{$table}.id", $ids)->whereNotNull("{$parent}.user_id")
            ->pluck("{$parent}.user_id", "{$table}.id")->all();
    }
}
