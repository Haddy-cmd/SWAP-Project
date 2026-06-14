<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NarrativeReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'time_log_id',
        'content',
        'activities_done',
        'challenges',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
        ];
    }

    public function timeLog(): BelongsTo
    {
        return $this->belongsTo(TimeLog::class);
    }
}
