<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Interview extends Model
{
    use HasFactory;

    protected $fillable = [
        'application_id',
        'scheduled_at',
        'location',
        'meeting_link',
        'duration_minutes',
        'mode',
        'notes',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'duration_minutes' => 'integer',
        ];
    }

    /** Reschedule trail (newest first) — eager-loadable for the admin list. */
    public function rescheduleHistory(): MorphMany
    {
        return $this->morphMany(AuditLog::class, 'auditable')
            ->where('action', 'rescheduled')
            ->orderByDesc('created_at');
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }
}
