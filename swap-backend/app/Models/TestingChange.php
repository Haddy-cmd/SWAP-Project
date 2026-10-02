<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One thing a System Testing shortcut did to a picked (existing) account: a record it
 * created, the raw column values a record had before the shortcut updated it, or a
 * full copy of a record it deleted (with the rows that hang off it) to put back.
 */
class TestingChange extends Model
{
    public const CREATED = 'created';
    public const UPDATED = 'updated';
    public const DELETED = 'deleted';

    protected $fillable = ['user_id', 'subject_type', 'subject_id', 'action', 'old_values', 'created_by'];

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
        ];
    }
}
