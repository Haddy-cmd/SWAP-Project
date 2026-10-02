<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One message in a concern thread — the opener or a reply, from the student or the DSA. */
class ConcernMessage extends Model
{
    protected $fillable = [
        'concern_id',
        'user_id',
        'from_staff',
        'body',
    ];

    protected function casts(): array
    {
        return [
            'from_staff' => 'boolean',
        ];
    }

    public function concern(): BelongsTo
    {
        return $this->belongsTo(Concern::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
