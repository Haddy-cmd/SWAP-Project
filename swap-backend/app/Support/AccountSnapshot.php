<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * A student's whole SWAP record — applications, placements, hours, promissory notes,
 * reports, evaluations, stipend stubs, with everything that hangs off them — copied as raw
 * rows, and put back exactly (same IDs, same values) for System Testing. Rows are read and
 * written with the query builder, so no model events, casts or side effects run.
 * The user row, profile, concerns and audit logs are never touched.
 */
class AccountSnapshot
{
    /**
     * The tables of a student's record, parents before children: how each one's rows are
     * found — by the student's id, and/or by the ids of a parent table's rows.
     */
    private const TABLES = [
        'applications' => ['user' => true],
        'application_documents' => ['parent' => ['application_id' => 'applications']],
        'interviews' => ['parent' => ['application_id' => 'applications']],
        'assignments' => ['user' => true],
        'time_logs' => ['user' => true, 'parent' => ['assignment_id' => 'assignments']],
        'narrative_reports' => ['parent' => ['time_log_id' => 'time_logs']],
        'verifications' => ['parent' => ['time_log_id' => 'time_logs']],
        'promissory_notes' => ['user' => true, 'parent' => ['assignment_id' => 'assignments']],
        'term_reports' => ['user' => true, 'parent' => ['assignment_id' => 'assignments']],
        'term_evaluations' => ['parent' => ['assignment_id' => 'assignments']],
        'weekly_reports' => ['user' => true, 'parent' => ['assignment_id' => 'assignments']],
        'monthly_reports' => ['user' => true, 'parent' => ['assignment_id' => 'assignments']],
        'semester_reports' => ['user' => true, 'parent' => ['assignment_id' => 'assignments']],
        'stipend_history' => ['user' => true],
        'stipend_signatures' => ['parent' => ['stipend_history_id' => 'stipend_history']],
    ];

    /** Bell-notification keys that point at a row of these tables. */
    private const NOTIFICATION_KEYS = [
        'applications' => 'application_id',
        'assignments' => 'assignment_id',
        'time_logs' => 'log_id',
        'promissory_notes' => 'promissory_id',
        'stipend_history' => 'stipend_id',
    ];

    /** @var array<string, list<string>>|null columns the database computes (never written) */
    private static ?array $generated = null;

    /** @return array{tables: array<string, list<array<string, mixed>>>} */
    public function take(User $user): array
    {
        return ['tables' => array_map(fn (array $rows) => array_values($rows), $this->current($user->id))];
    }

    /**
     * Put the student's record back to the snapshot: rows added since are removed (with
     * their files and the bell entries about them), changed rows go back, removed rows
     * return with their own IDs.
     *
     * @return array{removed: int, restored: int, files: int, notifications: int}
     */
    public function restore(User $user, array $snapshot, Carbon $since): array
    {
        $current = $this->current($user->id);
        $saved = [];
        foreach (array_keys(self::TABLES) as $table) {
            $saved[$table] = collect($snapshot['tables'][$table] ?? [])->keyBy('id')->all();
        }

        $new = [];
        $restored = 0;
        foreach (array_keys(self::TABLES) as $table) {
            $new[$table] = array_diff_key($current[$table], $saved[$table]);
            foreach ($saved[$table] as $id => $row) {
                if (!isset($current[$table][$id]) || self::normalize($current[$table][$id]) !== self::normalize($row)) {
                    $restored++;
                }
            }
        }

        DB::transaction(function () use ($current, $saved) {
            // Children first out, parents first back in, each table in id order (a
            // placement's carried_from_assignment_id points at an older one).
            foreach (array_reverse(array_keys(self::TABLES)) as $table) {
                foreach (array_chunk(array_keys($current[$table]), 500) as $ids) {
                    DB::table($table)->whereIn('id', $ids)->delete();
                }
            }
            foreach (array_keys(self::TABLES) as $table) {
                $rows = collect($saved[$table])->sortKeys()
                    ->map(fn (array $row) => array_diff_key($row, array_flip(self::generated($table))))
                    ->values()->all();
                foreach (array_chunk($rows, 200) as $chunk) {
                    DB::table($table)->insert($chunk);
                }
            }
        });

        $files = $this->deleteFiles($new, $saved, $current);
        $notifications = $this->deleteNotifications($user->id, $since, null, $new);

        return [
            'removed' => array_sum(array_map('count', $new)),
            'restored' => $restored,
            'files' => $files,
            'notifications' => $notifications,
        ];
    }

    /**
     * The student's current rows, table => [id => row]. Rows of a table are those owned by
     * the student, or hanging off one of the student's parent rows.
     *
     * @return array<string, array<int, array<string, mixed>>>
     */
    public function current(int $userId): array
    {
        $rows = [];
        foreach (self::TABLES as $table => $how) {
            $query = DB::table($table)->where(function ($q) use ($how, $userId, &$rows) {
                $q->whereRaw('1 = 0');
                if ($how['user'] ?? false) {
                    $q->orWhere('user_id', $userId);
                }
                foreach ($how['parent'] ?? [] as $key => $parent) {
                    $ids = array_keys($rows[$parent] ?? []);
                    if ($ids) {
                        $q->orWhereIn($key, $ids);
                    }
                }
            });
            $rows[$table] = $query->orderBy('id')->get()
                ->map(fn ($row) => array_diff_key((array) $row, array_flip(self::generated($table))))
                ->keyBy('id')->all();
        }

        return $rows;
    }

    /**
     * Remove the given rows (and the rows hanging off them), with their files and the bell
     * entries about them. Used by the cleanup of accounts tested before snapshots existed.
     *
     * @param  array<string, array<int, array<string, mixed>>>  $rows  table => [id => row]
     * @param  list<array{start: Carbon, end: Carbon}>  $windows  the student's bell entries from these go too
     * @return array{files: int, notifications: int}
     */
    public function deleteRows(int $userId, array $rows, array $windows = []): array
    {
        DB::transaction(function () use ($rows) {
            foreach (array_reverse(array_keys(self::TABLES)) as $table) {
                foreach (array_chunk(array_keys($rows[$table] ?? []), 500) as $ids) {
                    DB::table($table)->whereIn('id', $ids)->delete();
                }
            }
        });

        $notifications = 0;
        foreach ($windows as $i => $window) {
            // Bell entries about the removed rows only need clearing once.
            $notifications += $this->deleteNotifications($userId, $window['start'], $window['end'], $i === 0 ? $rows : []);
        }

        return ['files' => $this->deleteFiles($rows, [], []), 'notifications' => $notifications];
    }

    /**
     * Add to `$selected` every row of `$all` that hangs off a selected row (a removed
     * placement takes its hours, notes and reports with it).
     *
     * @param  array<string, array<int, array<string, mixed>>>  $selected  table => [id => row]
     * @param  array<string, array<int, array<string, mixed>>>  $all  table => [id => row]
     */
    public static function withChildren(array $selected, array $all): array
    {
        foreach (self::TABLES as $table => $how) {
            foreach ($how['parent'] ?? [] as $key => $parent) {
                foreach ($all[$table] ?? [] as $id => $row) {
                    if (isset($selected[$parent][$row[$key] ?? null])) {
                        $selected[$table][$id] = $row;
                    }
                }
            }
        }

        return $selected;
    }

    /** @return list<string> */
    public static function tables(): array
    {
        return array_keys(self::TABLES);
    }

    /**
     * Files only removed rows used, unless a kept row uses the same path: documents,
     * promissory notes, selfies, stub PDFs and stub signatures. A stub that changed loses its
     * PDF too; downloading it rebuilds it from the restored data.
     */
    private function deleteFiles(array $removed, array $saved, array $current): int
    {
        $disk = Storage::disk(config('filesystems.documents_disk', 'public'));
        $keep = [];
        foreach ($saved as $rows) {
            foreach ($rows as $row) {
                foreach (['file_path', 'time_in_photo_path', 'signature_image_path', 'slip_path'] as $column) {
                    if (!empty($row[$column])) {
                        $keep[$row[$column]] = true;
                    }
                }
            }
        }

        $paths = [];
        $folders = [];
        foreach ($removed['application_documents'] ?? [] as $row) {
            $paths[] = $row['file_path'] ?? null;
        }
        foreach ($removed['applications'] ?? [] as $id => $row) {
            $folders[] = "documents/{$id}";
        }
        foreach ($removed['promissory_notes'] ?? [] as $row) {
            $paths[] = $row['file_path'] ?? null;
        }
        foreach ($removed['time_logs'] ?? [] as $row) {
            $paths[] = $row['time_in_photo_path'] ?? null;
        }
        foreach ($removed['stipend_signatures'] ?? [] as $row) {
            $paths[] = $row['signature_image_path'] ?? null;
        }
        foreach ($removed['stipend_history'] ?? [] as $id => $row) {
            $folders[] = "stipend-slips/{$id}";
            $folders[] = "stipend-signatures/{$id}";
        }
        // A restored stub whose state changed (e.g. paid during the test): its PDF shows the
        // test state, so it goes and is rebuilt on the next download.
        foreach ($saved['stipend_history'] ?? [] as $id => $row) {
            $now = $current['stipend_history'][$id] ?? null;
            if ($now && !empty($now['slip_path']) && self::normalize($now) !== self::normalize($row)) {
                $paths[] = $now['slip_path'];
                unset($keep[$now['slip_path']]);
            }
        }

        $count = 0;
        foreach (array_unique(array_filter($paths)) as $path) {
            if (!isset($keep[$path]) && $disk->exists($path)) {
                $disk->delete($path);
                $count++;
            }
        }
        foreach (array_unique($folders) as $folder) {
            if ($disk->directoryExists($folder)) {
                $count += count($disk->allFiles($folder));
                $disk->deleteDirectory($folder);
            }
        }

        return $count;
    }

    /**
     * The student's bell entries from the test window, and anyone's that point at a removed
     * row (e.g. the supervisor's "promissory note submitted").
     */
    private function deleteNotifications(int $userId, Carbon $from, ?Carbon $to, array $removed): int
    {
        $count = DB::table('notifications')
            ->where('notifiable_type', User::class)->where('notifiable_id', $userId)
            ->where('created_at', '>=', $from)
            ->when($to, fn ($q) => $q->where('created_at', '<=', $to))
            ->delete();

        foreach (self::NOTIFICATION_KEYS as $table => $key) {
            foreach (array_keys($removed[$table] ?? []) as $id) {
                $count += DB::table('notifications')->where(fn ($q) => $q
                    ->whereRaw('CAST(data AS TEXT) LIKE ?', ['%"' . $key . '":' . $id . ',%'])
                    ->orWhereRaw('CAST(data AS TEXT) LIKE ?', ['%"' . $key . '":' . $id . '}%']))->delete();
            }
        }

        return $count;
    }

    /** Columns PostgreSQL computes itself (e.g. time_logs.duration_hours): never copied or written. */
    private static function generated(string $table): array
    {
        self::$generated ??= collect(DB::select(
            "select table_name, column_name from information_schema.columns where table_schema = current_schema() and is_generated = 'ALWAYS'"
        ))->groupBy('table_name')->map(fn (Collection $c) => $c->pluck('column_name')->all())->all();

        return self::$generated[$table] ?? [];
    }

    /** The same row read from the database or from the JSON snapshot compares equal. */
    private static function normalize(array $row): string
    {
        ksort($row);

        return json_encode(json_decode(json_encode($row), true));
    }
}
