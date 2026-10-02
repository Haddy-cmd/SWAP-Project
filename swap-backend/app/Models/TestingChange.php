<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One thing a System Testing shortcut did to a picked (existing) account: a record it
 * created, or the raw column values a record had before the shortcut updated it.
 */
class TestingChange extends Model
{
    public const CREATED = 'created';
    public const UPDATED = 'updated';

    protected $fillable = ['user_id', 'subject_type', 'subject_id', 'action', 'old_values', 'created_by'];

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
        ];
    }
}
