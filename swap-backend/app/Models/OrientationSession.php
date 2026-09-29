<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrientationSession extends Model
{
    protected $fillable = [
        'title',
        'scheduled_at',
        'mode',
        'location',
        'meeting_link',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
        ];
    }

    public function attendees(): HasMany
    {
        return $this->hasMany(OrientationAttendee::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Where to go: the venue in person, the meeting link online. */
    public function venue(): ?string
    {
        return $this->mode === 'online' ? $this->meeting_link : $this->location;
    }
}
