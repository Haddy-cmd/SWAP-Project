<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * The copy of a student's record taken when System Testing picked them
 * (App\Support\AccountSnapshot); removing them or switching testing off restores it.
 */
class TestingSnapshot extends Model
{
    protected $fillable = ['user_id', 'taken_at', 'data'];

    protected function casts(): array
    {
        return [
            'taken_at' => 'datetime',
            'data' => 'array',
        ];
    }
}
