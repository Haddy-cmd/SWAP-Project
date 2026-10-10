<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A DSA announcement sent to every active recipient (portal + email). */
class Announcement extends Model
{
    protected $fillable = [
        'title',
        'message',
        'sent_by',
        'recipient_count',
        'emailed_count',
    ];

    protected function casts(): array
    {
        return [
            'recipient_count' => 'integer',
            'emailed_count' => 'integer',
        ];
    }

    /** Photos and documents sent with it, in the order they were attached. */
    public function attachments(): HasMany
    {
        return $this->hasMany(AnnouncementAttachment::class)->orderBy('position')->orderBy('id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }
}
