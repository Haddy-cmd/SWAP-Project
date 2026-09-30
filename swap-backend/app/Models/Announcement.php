<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }
}
