<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrientationAttendee extends Model
{
    public const STATUS_INVITED = 'invited';
    public const STATUS_ATTENDED = 'attended';
    public const STATUS_ABSENT = 'absent';

    public const STATUSES = [self::STATUS_INVITED, self::STATUS_ATTENDED, self::STATUS_ABSENT];

    protected $fillable = [
        'orientation_session_id',
        'user_id',
        'status',
        'marked_by',
        'marked_at',
    ];

    protected function casts(): array
    {
        return [
            'marked_at' => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(OrientationSession::class, 'orientation_session_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function markedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'marked_by');
    }
}
